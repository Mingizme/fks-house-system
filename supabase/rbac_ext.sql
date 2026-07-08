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
  create type leaderboard_visibility as enum ('public', 'masters_only');
exception when duplicate_object then null; end $$;

-- Bảng cài đặt hệ thống (singleton row — chỉ 1 row)
create table if not exists system_settings (
  id int primary key default 1,
  leaderboard_visibility leaderboard_visibility not null default 'public',
  updated_at timestamptz default now(),
  constraint only_one_row check (id = 1)
);

insert into system_settings (id, leaderboard_visibility) values (1, 'public')
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
    when (select leaderboard_visibility from system_settings where id = 1) = 'public' then true
    when (select leaderboard_visibility from system_settings where id = 1) = 'masters_only'
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
