-- =========================================================
-- RBAC EXTENSION — Mute Duration, Point Visibility, Leaderboard Visibility, Admin Directory
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
-- (an toàn khi chạy lại nhiều lần — idempotent)
-- Yêu cầu: đã chạy schema.sql + house_master.sql + rbac.sql trước đó.
-- =========================================================

-- =========================================================
-- PHẦN 1 — MUTE CÓ THỜI HẠN (DURATION) + TỰ ĐỘNG GỠ
-- =========================================================

-- Đảm bảo cột mute đã có (rbac.sql giới thiệu, ở đây xác nhận)
alter table profiles add column if not exists muted_until timestamptz;
alter table profiles add column if not exists muted_by uuid references profiles(id) on delete set null;
alter table profiles add column if not exists mute_reason text;

create index if not exists idx_profiles_muted_until on profiles(muted_until) where muted_until is not null;

-- RPC: mute một user (admin-only, có thời hạn). Quyền = can_manage_admin(target).
create or replace function mute_user(target_id uuid, duration_minutes int, reason text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  until_ts timestamptz;
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to mute this user.';
  end if;

  if duration_minutes is null or duration_minutes <= 0 then
    raise exception 'Duration must be a positive number of minutes.';
  end if;

  if duration_minutes > 44640 then
    raise exception 'Mute duration cannot exceed 31 days (44640 minutes).';
  end if;

  until_ts := now() + (duration_minutes || ' minutes')::interval;

  update profiles
    set muted_until = until_ts,
        muted_by = auth.uid(),
        mute_reason = coalesce(nullif(trim(reason), ''), mute_reason)
    where id = target_id;

  perform log_moderation_event(target_id, 'mute', reason, until_ts);
end;
$$;

-- RPC: gỡ mute thủ công (admin có quyền quản lý target)
create or replace function unmute_user(target_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to unmute this user.';
  end if;
  update profiles
    set muted_until = null,
        muted_by = null,
        mute_reason = null
    where id = target_id;

  perform log_moderation_event(target_id, 'unmute');
end;
$$;

-- Helper: kiểm tra user hiện tại có đang bị mute không (lazy unmute)
-- Trả về false nếu muted_until đã quá hạn (không cần cron).
create or replace function is_currently_muted(user_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = user_id
      and muted_until is not null
      and muted_until > now()
  );
$$;

-- Helper: lấy thông tin mute hiện tại của user (để UI hiển thị thời gian còn lại)
-- Trả về null nếu không bị mute hoặc đã hết hạn
create or replace function get_mute_status(user_id uuid)
returns table(muted_until timestamptz, muted_by uuid, mute_reason text, muted_by_name text)
language sql security definer stable
set search_path = public
as $$
  select p.muted_until, p.muted_by, p.mute_reason, a.display_name as muted_by_name
  from profiles p
  left join profiles a on a.id = p.muted_by
  where p.id = user_id
    and p.muted_until is not null
    and p.muted_until > now();
$$;

grant execute on function mute_user(uuid, int, text) to authenticated;
grant execute on function unmute_user(uuid) to authenticated;
grant execute on function is_currently_muted(uuid) to authenticated;
grant execute on function get_mute_status(uuid) to authenticated;

-- =========================================================
-- PHAN 1B - CHAT BAN, ACCOUNT BAN, IP BAN + AUDIT
-- =========================================================

alter table profiles add column if not exists chat_banned_at timestamptz;
alter table profiles add column if not exists chat_banned_by uuid references profiles(id) on delete set null;
alter table profiles add column if not exists chat_ban_reason text;
alter table profiles add column if not exists account_banned_at timestamptz;
alter table profiles add column if not exists account_banned_by uuid references profiles(id) on delete set null;
alter table profiles add column if not exists account_ban_reason text;
alter table profiles add column if not exists last_seen_ip inet;
alter table profiles add column if not exists last_seen_at timestamptz;

create index if not exists idx_profiles_chat_banned_at on profiles(chat_banned_at) where chat_banned_at is not null;
create index if not exists idx_profiles_account_banned_at on profiles(account_banned_at) where account_banned_at is not null;
create index if not exists idx_profiles_last_seen_ip on profiles(last_seen_ip) where last_seen_ip is not null;

-- Refresh moderation permission logic: every admin can moderate players.
-- Higher-rank admin-to-admin rules still come from the existing RBAC model.
create or replace function can_manage_admin(target_id uuid)
returns boolean
language plpgsql security definer stable
set search_path = public
as $$
declare
  me record;
  target record;
begin
  if auth.uid() = target_id then
    return false;
  end if;

  select user_type, admin_rank, department_id into me
    from profiles where id = auth.uid();
  if me.user_type <> 'admin' then
    return false;
  end if;

  if me.admin_rank = 'global_director' then
    return true;
  end if;

  select user_type, admin_rank, department_id into target
    from profiles where id = target_id;

  if target.user_type = 'player' then
    return true;
  end if;

  if me.admin_rank = 'director' then
    return target.admin_rank = 'member' and target.department_id = me.department_id;
  end if;

  return false;
end;
$$;

create table if not exists moderation_events (
  id uuid primary key default uuid_generate_v4(),
  target_id uuid references profiles(id) on delete cascade not null,
  actor_id uuid references profiles(id) on delete set null,
  action text not null check (action in (
    'mute',
    'unmute',
    'chat_ban',
    'chat_unban',
    'account_ban',
    'account_unban',
    'ip_ban',
    'ip_unban'
  )),
  reason text,
  expires_at timestamptz,
  ip_address inet,
  created_at timestamptz default now()
);

create index if not exists idx_moderation_events_target on moderation_events(target_id, created_at desc);

alter table moderation_events enable row level security;

drop policy if exists "moderation_events_select_admin" on moderation_events;
create policy "moderation_events_select_admin" on moderation_events for select
  to authenticated using (is_admin());

create table if not exists ip_bans (
  id uuid primary key default uuid_generate_v4(),
  ip_address inet not null,
  banned_by uuid references profiles(id) on delete set null,
  reason text,
  created_at timestamptz default now(),
  lifted_at timestamptz,
  lifted_by uuid references profiles(id) on delete set null
);

create unique index if not exists idx_ip_bans_active_unique
  on ip_bans(ip_address) where lifted_at is null;
create index if not exists idx_ip_bans_ip on ip_bans(ip_address);

alter table ip_bans enable row level security;

drop policy if exists "ip_bans_select_admin" on ip_bans;
create policy "ip_bans_select_admin" on ip_bans for select
  to authenticated using (is_admin());

create or replace function log_moderation_event(
  target_id uuid,
  action text,
  reason text default null,
  expires_at timestamptz default null,
  ip_address inet default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into moderation_events (target_id, actor_id, action, reason, expires_at, ip_address)
  values (target_id, auth.uid(), action, nullif(trim(reason), ''), expires_at, ip_address);
end;
$$;

create or replace function is_account_banned(user_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = user_id
      and account_banned_at is not null
  );
$$;

create or replace function is_chat_restricted(user_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = user_id
      and (
        account_banned_at is not null
        or chat_banned_at is not null
        or (muted_until is not null and muted_until > now())
      )
  );
$$;

create or replace function get_chat_restriction_status(user_id uuid)
returns table(
  muted_until timestamptz,
  muted_by uuid,
  mute_reason text,
  muted_by_name text,
  chat_banned_at timestamptz,
  chat_banned_by uuid,
  chat_ban_reason text,
  chat_banned_by_name text,
  account_banned_at timestamptz,
  account_banned_by uuid,
  account_ban_reason text,
  account_banned_by_name text
)
language sql security definer stable
set search_path = public
as $$
  select
    p.muted_until,
    p.muted_by,
    p.mute_reason,
    muted_admin.display_name,
    p.chat_banned_at,
    p.chat_banned_by,
    p.chat_ban_reason,
    chat_admin.display_name,
    p.account_banned_at,
    p.account_banned_by,
    p.account_ban_reason,
    account_admin.display_name
  from profiles p
  left join profiles muted_admin on muted_admin.id = p.muted_by
  left join profiles chat_admin on chat_admin.id = p.chat_banned_by
  left join profiles account_admin on account_admin.id = p.account_banned_by
  where p.id = user_id
    and (
      (p.muted_until is not null and p.muted_until > now())
      or p.chat_banned_at is not null
      or p.account_banned_at is not null
    );
$$;

create or replace function ban_chat_user(target_id uuid, reason text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to ban this user from chat.';
  end if;

  update profiles
    set chat_banned_at = now(),
        chat_banned_by = auth.uid(),
        chat_ban_reason = nullif(trim(reason), '')
    where id = target_id;

  perform log_moderation_event(target_id, 'chat_ban', reason);
end;
$$;

create or replace function unban_chat_user(target_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to unban this user from chat.';
  end if;

  update profiles
    set chat_banned_at = null,
        chat_banned_by = null,
        chat_ban_reason = null
    where id = target_id;

  perform log_moderation_event(target_id, 'chat_unban');
end;
$$;

create or replace function ban_account_user(target_id uuid, reason text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to ban this account.';
  end if;

  update profiles
    set account_banned_at = now(),
        account_banned_by = auth.uid(),
        account_ban_reason = nullif(trim(reason), '')
    where id = target_id;

  perform log_moderation_event(target_id, 'account_ban', reason);
end;
$$;

create or replace function unban_account_user(target_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to unban this account.';
  end if;

  update profiles
    set account_banned_at = null,
        account_banned_by = null,
        account_ban_reason = null
    where id = target_id;

  perform log_moderation_event(target_id, 'account_unban');
end;
$$;

create or replace function ban_last_seen_ip(target_id uuid, reason text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  target_ip inet;
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to ban this IP.';
  end if;

  select last_seen_ip into target_ip from profiles where id = target_id;
  if target_ip is null then
    raise exception 'This user does not have a recorded IP address yet.';
  end if;

  insert into ip_bans (ip_address, banned_by, reason)
  values (target_ip, auth.uid(), nullif(trim(reason), ''))
  on conflict (ip_address) where lifted_at is null
  do update set lifted_at = null,
                lifted_by = null,
                banned_by = excluded.banned_by,
                created_at = now(),
                reason = coalesce(nullif(excluded.reason, ''), ip_bans.reason);

  perform log_moderation_event(target_id, 'ip_ban', reason, null, target_ip);
end;
$$;

create or replace function unban_last_seen_ip(target_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  target_ip inet;
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to unban this IP.';
  end if;

  select last_seen_ip into target_ip from profiles where id = target_id;
  if target_ip is null then
    raise exception 'This user does not have a recorded IP address yet.';
  end if;

  update ip_bans
    set lifted_at = now(),
        lifted_by = auth.uid()
    where ip_address = target_ip and lifted_at is null;

  perform log_moderation_event(target_id, 'ip_unban', null, null, target_ip);
end;
$$;

create or replace function record_profile_ip(ip_text text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null or nullif(trim(ip_text), '') is null then
    return;
  end if;

  update profiles
    set last_seen_ip = trim(ip_text)::inet,
        last_seen_at = now()
    where id = auth.uid();
exception
  when invalid_text_representation then
    return;
end;
$$;

create or replace function is_ip_banned(ip_text text)
returns boolean
language plpgsql security definer stable
set search_path = public
as $$
declare
  parsed_ip inet;
begin
  if nullif(trim(ip_text), '') is null then
    return false;
  end if;

  parsed_ip := trim(ip_text)::inet;
  return exists (
    select 1 from ip_bans
    where ip_address = parsed_ip
      and lifted_at is null
  );
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke execute on function log_moderation_event(uuid, text, text, timestamptz, inet) from public;
revoke execute on function log_moderation_event(uuid, text, text, timestamptz, inet) from authenticated;
grant execute on function is_account_banned(uuid) to authenticated;
grant execute on function is_chat_restricted(uuid) to authenticated;
grant execute on function get_chat_restriction_status(uuid) to authenticated;
grant execute on function ban_chat_user(uuid, text) to authenticated;
grant execute on function unban_chat_user(uuid) to authenticated;
grant execute on function ban_account_user(uuid, text) to authenticated;
grant execute on function unban_account_user(uuid) to authenticated;
grant execute on function ban_last_seen_ip(uuid, text) to authenticated;
grant execute on function unban_last_seen_ip(uuid) to authenticated;
grant execute on function record_profile_ip(text) to authenticated;
grant execute on function is_ip_banned(text) to anon, authenticated;

-- Enforce moderation at the database boundary for every chat insert path.
drop policy if exists "dm_insert_own" on direct_messages;
create policy "dm_insert_own" on direct_messages for insert
  to authenticated with check (
    sender_id = auth.uid()
    and not is_chat_restricted(auth.uid())
    and not has_blocked(sender_id, recipient_id)
    and (is_admin_chat = false or (is_admin() and exists(
      select 1 from profiles p where p.id = recipient_id and p.user_type = 'admin'
    )))
  );

drop policy if exists "house_msg_insert" on house_messages;
create policy "house_msg_insert" on house_messages for insert
  to authenticated with check (
    sender_id = auth.uid()
    and not is_chat_restricted(auth.uid())
    and (is_admin() or house_id = my_house_id())
  );

drop policy if exists "Admins can insert admin messages" on admin_messages;
create policy "Admins can insert admin messages"
  on admin_messages for insert
  to authenticated with check (is_admin() and auth.uid() = sender_id and not is_chat_restricted(auth.uid()));

-- =========================================================
-- PHẦN 2 — HOUSE SCORES VISIBILITY FLAGS
-- =========================================================

-- Trạng thái hiển thị điểm house đối với thành viên trong house
do $$ begin
  create type house_score_visibility as enum ('visible', 'hidden');
exception when duplicate_object then null; end $$;

-- Cờ toggle quyền của House Master
do $$ begin
  create type house_master_toggle as enum ('allowed', 'blocked');
exception when duplicate_object then null; end $$;

-- Thêm cột cấu hình hiển thị điểm cho mỗi house
alter table houses add column if not exists score_visibility house_score_visibility not null default 'visible';
-- Admin có thể cấm House Master đổi trạng thái hiển thị điểm
alter table houses add column if not exists master_can_toggle_score house_master_toggle not null default 'allowed';

-- RPC: House Master bật/tắt hiển thị điểm (chỉ master của house đó, và chưa bị admin cấm)
create or replace function set_house_score_visibility(house_uuid uuid, visibility house_score_visibility)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  h record;
begin
  select score_visibility, master_can_toggle_score into h
    from houses where id = house_uuid;

  if not found then
    raise exception 'House not found.';
  end if;

  if h.master_can_toggle_score = 'blocked' then
    raise exception 'An admin has blocked the House Master from toggling score visibility.';
  end if;

  if my_house_id() <> house_uuid or my_house_role() <> 'master' then
    raise exception 'Only the House Master of this house can toggle score visibility.';
  end if;

  update houses set score_visibility = visibility where id = house_uuid;
end;
$$;

-- RPC: Admin cấm/cho phép House Master đổi hiển thị điểm
create or replace function admin_set_master_score_toggle(house_uuid uuid, toggle house_master_toggle)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can set this toggle.';
  end if;
  update houses set master_can_toggle_score = toggle where id = house_uuid;
end;
$$;

grant execute on function set_house_score_visibility(uuid, house_score_visibility) to authenticated;
grant execute on function admin_set_master_score_toggle(uuid, house_master_toggle) to authenticated;

-- =========================================================
-- PHẦN 3 — CẤM ĐÍCH DANH HOUSE MASTER XEM ĐIỂM
-- =========================================================

-- Bảng ghi nhận các House Master bị admin cấm xem điểm house
create table if not exists house_master_score_blocks (
  id uuid primary key default uuid_generate_v4(),
  house_id uuid references houses(id) on delete cascade not null,
  master_id uuid references profiles(id) on delete cascade not null,
  blocked_by uuid references profiles(id) on delete set null not null,
  created_at timestamptz default now(),
  unique (master_id)
);

create index if not exists idx_score_blocks_house on house_master_score_blocks(house_id);

alter table house_master_score_blocks enable row level security;

drop policy if exists "score_blocks_select_all" on house_master_score_blocks;
create policy "score_blocks_select_all" on house_master_score_blocks for select
  to authenticated using (true);

drop policy if exists "score_blocks_insert_admin" on house_master_score_blocks;
create policy "score_blocks_insert_admin" on house_master_score_blocks for insert
  to authenticated with check (is_admin() and blocked_by = auth.uid());

drop policy if exists "score_blocks_delete_admin" on house_master_score_blocks;
create policy "score_blocks_delete_admin" on house_master_score_blocks for delete
  to authenticated using (is_admin());

-- RPC: Admin cấm 1 House Master (theo id) xem điểm của house
create or replace function admin_block_master_score(master_uuid uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  m_house_id uuid;
begin
  if not is_admin() then
    raise exception 'Only admins can block a master from viewing scores.';
  end if;

  select house_id into m_house_id from profiles where id = master_uuid and house_role = 'master';
  if m_house_id is null then
    raise exception 'Target is not a House Master.';
  end if;

  insert into house_master_score_blocks (house_id, master_id, blocked_by)
    values (m_house_id, master_uuid, auth.uid())
    on conflict (master_id) do nothing;
end;
$$;

-- RPC: Admin gỡ cấm
create or replace function admin_unblock_master_score(master_uuid uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can unblock a master.';
  end if;
  delete from house_master_score_blocks where master_id = master_uuid;
end;
$$;

grant execute on function admin_block_master_score(uuid) to authenticated;
grant execute on function admin_unblock_master_score(uuid) to authenticated;

-- =========================================================
-- PHẦN 4 — LEADERBOARD VISIBILITY TOÀN HỆ THỐNG
-- =========================================================

do $$ begin
  create type leaderboard_visibility as enum ('public', 'masters_only', 'admin_only');
exception when duplicate_object then null; end $$;

alter type leaderboard_visibility add value if not exists 'admin_only';

-- Bảng cài đặt hệ thống (singleton row — chỉ 1 row)
create table if not exists system_settings (
  id int primary key default 1,
  leaderboard_visibility leaderboard_visibility not null default 'public',
  role_title_editing_locked boolean not null default false,
  updated_at timestamptz default now(),
  constraint only_one_row check (id = 1)
);

alter table system_settings
  add column if not exists role_title_editing_locked boolean not null default false;

insert into system_settings (id, leaderboard_visibility, role_title_editing_locked) values (1, 'public', false)
  on conflict (id) do nothing;

alter table system_settings enable row level security;

drop policy if exists "settings_select_all" on system_settings;
create policy "settings_select_all" on system_settings for select
  to authenticated using (true);

-- Đổi visibility chỉ qua RPC
create or replace function admin_set_leaderboard_visibility(visibility leaderboard_visibility)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can change leaderboard visibility.';
  end if;
  update system_settings
    set leaderboard_visibility = visibility,
        updated_at = now()
    where id = 1;
end;
$$;

grant execute on function admin_set_leaderboard_visibility(leaderboard_visibility) to authenticated;

-- Global Director có thể khóa/mở chức năng director tự đổi title role.
create or replace function admin_set_role_title_editing_locked(locked boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_global_director() then
    raise exception 'Only a Global Director can change role title editing lock.';
  end if;

  update system_settings
    set role_title_editing_locked = locked,
        updated_at = now()
    where id = 1;
end;
$$;

-- Director trở lên chỉ được đổi title role của chính department mình.
create or replace function admin_rename_own_role_title(new_title text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  me record;
  normalized_title text := nullif(trim(new_title), '');
  title_editing_locked boolean;
begin
  if normalized_title is null then
    raise exception 'Role title cannot be empty.';
  end if;

  if length(normalized_title) > 60 then
    raise exception 'Role title must be 60 characters or fewer.';
  end if;

  select role_title_editing_locked into title_editing_locked
    from system_settings
    where id = 1;

  if coalesce(title_editing_locked, false) then
    raise exception 'Role title editing is locked.';
  end if;

  select user_type, admin_rank, department_id into me
    from profiles
    where id = auth.uid();

  if me.user_type is distinct from 'admin'
     or me.admin_rank is null
     or me.admin_rank not in ('director', 'global_director') then
    raise exception 'Only Directors and Global Directors can rename their role title.';
  end if;

  if me.department_id is null then
    raise exception 'Your admin account is not assigned to a department.';
  end if;

  update departments
    set director_title = normalized_title
    where id = me.department_id;
end;
$$;

grant execute on function admin_set_role_title_editing_locked(boolean) to authenticated;
grant execute on function admin_rename_own_role_title(text) to authenticated;

-- =========================================================
-- PHẦN 5 — HELPER: KIỂM TRA PLAYER CÓ ĐƯỢC XEM LEADERBOARD ?
-- =========================================================

create or replace function can_view_leaderboard()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select case
    when is_admin() then true
    when not exists (select 1 from system_settings where id = 1) then true
    when (select leaderboard_visibility::text from system_settings where id = 1) = 'public' then true
    when (select leaderboard_visibility::text from system_settings where id = 1) = 'masters_only'
      and exists (select 1 from profiles where id = auth.uid() and house_role = 'master') then true
    else false
  end;
$$;

-- Helper: kiểm tra user có được xem điểm số của house cụ thể không
--  - Admin: luôn xem được
--  - House Master của house đó: nếu bị block thì không xem được
--  - Thành viên house: tuỳ theo score_visibility của house
--  - Người ngoài house: luôn xem được (điểm là public, chỉ "hiển thị trong house" là bật/tắt)
create or replace function can_view_house_score(house_uuid uuid, viewer_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select case
    when is_admin() then true
    when exists (
      select 1 from profiles p
      where p.id = viewer_id
        and p.house_role = 'master'
        and p.house_id = house_uuid
        and exists (select 1 from house_master_score_blocks b where b.master_id = viewer_id)
    ) then false
    when exists (
      select 1 from profiles p
      where p.id = viewer_id
        and p.house_id = house_uuid
        and (select score_visibility from houses where id = house_uuid) = 'hidden'
    ) then false
    else true
  end;
$$;

grant execute on function can_view_leaderboard() to authenticated;
grant execute on function can_view_house_score(uuid, uuid) to authenticated;

-- Rebuild house_points with score visibility awareness.
-- This keeps the existing aggregate shape, but masks the score for viewers
-- blocked by can_view_house_score().
create or replace view house_points as
select
  h.id as house_id,
  h.name,
  h.slug,
  h.color,
  h.icon,
  case
    when auth.uid() is not null and can_view_house_score(h.id, auth.uid()) then coalesce(sum(pt.points), 0)::bigint
    else null::bigint
  end as total_points,
  (auth.uid() is not null and can_view_house_score(h.id, auth.uid())) as can_view_score
from houses h
left join point_transactions pt on pt.house_id = h.id
group by h.id, h.name, h.slug, h.color, h.icon;

-- =========================================================
-- PHẦN 6 — PROFILE FULL: thêm cột cho Admin Directory
-- =========================================================

-- Đảm bảo profiles có admin_rank + department_id (rbac.sql đã thêm — idempotent)
alter table profiles add column if not exists admin_rank admin_rank;
alter table profiles add column if not exists department_id uuid references departments(id);

-- =========================================================
-- PHẦN 7 — REALTIME
-- =========================================================

do $$ begin
  alter publication supabase_realtime add table houses;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table system_settings;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table house_master_score_blocks;
exception when duplicate_object then null; end $$;
