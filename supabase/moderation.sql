-- =========================================================
-- MODERATION: Chat ban, Account ban, IP ban + ban last-seen IP
-- Chạy trong Supabase Dashboard > SQL Editor
-- (an toàn khi chạy lại nhiều lần — idempotent)
-- Yêu cầu: đã chạy schema.sql + house_master.sql + rbac.sql + rbac_ext.sql.
-- =========================================================

-- =========================================================
-- PHẦN 1 — CÁC CỘT BAN & LAST_IP TRÊN PROFILES
-- =========================================================

alter table profiles add column if not exists chat_banned_at timestamptz;
alter table profiles add column if not exists chat_banned_by uuid references profiles(id) on delete set null;
alter table profiles add column if not exists chat_ban_reason text;

alter table profiles add column if not exists account_banned_at timestamptz;
alter table profiles add column if not exists account_banned_by uuid references profiles(id) on delete set null;
alter table profiles add column if not exists account_ban_reason text;

alter table profiles add column if not exists last_seen_ip inet;
alter table profiles add column if not exists last_seen_at timestamptz;

create index if not exists idx_profiles_chat_banned on profiles(chat_banned_at) where chat_banned_at is not null;
create index if not exists idx_profiles_account_banned on profiles(account_banned_at) where account_banned_at is not null;

-- =========================================================
-- PHẦN 2 — BẢNG IP BANS
-- =========================================================

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

drop policy if exists "ip_bans_insert_admin" on ip_bans;
create policy "ip_bans_insert_admin" on ip_bans for insert
  to authenticated with check (is_admin() and banned_by = auth.uid());

drop policy if exists "ip_bans_update_admin" on ip_bans;
create policy "ip_bans_update_admin" on ip_bans for update
  to authenticated using (is_admin())
  with check (is_admin());

-- =========================================================
-- PHẦN 3 — RPC BAN CHAT
-- =========================================================

-- Ban chat một user: cấm gửi tin nhắn (permanent ban, khác mute có thời hạn)
create or replace function ban_chat_user(target_id uuid, reason text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to ban this user.';
  end if;

  update profiles
    set chat_banned_at = now(),
        chat_banned_by = auth.uid(),
        chat_ban_reason = coalesce(nullif(trim(reason), ''), chat_ban_reason)
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
    raise exception 'You do not have permission to unban this user.';
  end if;
  update profiles
    set chat_banned_at = null,
        chat_banned_by = null,
        chat_ban_reason = null
    where id = target_id;

  perform log_moderation_event(target_id, 'chat_unban');
end;
$$;

-- =========================================================
-- PHẦN 4 — RPC BAN TÀI KHOẢN
-- =========================================================

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
        account_ban_reason = coalesce(nullif(trim(reason), ''), account_ban_reason)
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

-- =========================================================
-- PHẦN 5 — RPC BAN IP CỦA 1 USER (ban last_seen_ip)
-- =========================================================

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
    raise exception 'No last-seen IP found for this user.';
  end if;

  insert into ip_bans (ip_address, banned_by, reason)
    values (target_ip, auth.uid(), coalesce(nullif(trim(reason), ''), null))
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
    raise exception 'No last-seen IP found for this user.';
  end if;

  update ip_bans
    set lifted_at = now(),
        lifted_by = auth.uid()
    where ip_address = target_ip
      and lifted_at is null;

  perform log_moderation_event(target_id, 'ip_unban', null, null, target_ip);
end;
$$;

-- =========================================================
-- PHẦN 6 — CHECK TÀI KHOẢN/CHAT/IP BAN CHO ĐĂNG NHẬP
-- =========================================================

create or replace function is_account_banned()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and account_banned_at is not null
  );
$$;

create or replace function is_current_ip_banned(client_ip text)
returns boolean
language plpgsql security definer stable
set search_path = public
as $$
declare
  parsed_ip inet;
begin
  if nullif(trim(client_ip), '') is null then
    return false;
  end if;

  parsed_ip := trim(client_ip)::inet;
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

-- RPC dùng từ client để kiểm tra ip (cho middleware RPC check)
create or replace function check_ip_ban(client_ip text)
returns table(is_banned boolean, reason text, banned_at timestamptz)
language plpgsql security definer stable
set search_path = public
as $$
declare
  parsed_ip inet;
begin
  if nullif(trim(client_ip), '') is null then
    return query select false, null::text, null::timestamptz;
    return;
  end if;

  parsed_ip := trim(client_ip)::inet;

  return query
  select true, b.reason, b.created_at
  from ip_bans b
  where b.ip_address = parsed_ip
    and b.lifted_at is null
  limit 1;

  if not found then
    return query select false, null::text, null::timestamptz;
  end if;
exception
  when invalid_text_representation then
    return query select false, null::text, null::timestamptz;
end;
$$;

-- Grant tất cả RPC
grant execute on function ban_chat_user(uuid, text) to authenticated;
grant execute on function unban_chat_user(uuid) to authenticated;
grant execute on function ban_account_user(uuid, text) to authenticated;
grant execute on function unban_account_user(uuid) to authenticated;
grant execute on function ban_last_seen_ip(uuid, text) to authenticated;
grant execute on function unban_last_seen_ip(uuid) to authenticated;
grant execute on function is_account_banned() to authenticated;
grant execute on function is_current_ip_banned(text) to authenticated, anon;
grant execute on function check_ip_ban(text) to authenticated, anon;

-- =========================================================
-- PHẦN 7 — REALTIME
-- =========================================================
do $$ begin
  alter publication supabase_realtime add table ip_bans;
exception when duplicate_object then null; end $$;

-- =========================================================
-- PHẦN 8 — TRIGGER: cập nhật auth.users khi account bị ban
-- =========================================================
-- (tự động update `banned` flag của auth.users để Supabase từ chối đăng nhập)
create or replace function sync_account_ban_to_auth()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.account_banned_at is not null and old.account_banned_at is null then
    -- Ban tài khoản: cập nhật auth.users ban flag
    update auth.users
      set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('account_banned', true, 'ban_reason', new.account_ban_reason)
      where id = new.id;
  elsif new.account_banned_at is null and old.account_banned_at is not null then
    -- Bỏ ban: xoá ban flag
    update auth.users
      set raw_user_meta_data = raw_user_meta_data - 'account_banned' - 'ban_reason'
      where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_account_ban_sync on profiles;
create trigger profile_account_ban_sync
  after update of account_banned_at on profiles
  for each row execute procedure sync_account_ban_to_auth();

-- =========================================================
-- PHẦN 9 — MIDDLEWARE-CHAINED BAN CHECKER
-- =========================================================
-- Hàm này được gọi tại client để kiểm tra ban + IP trước khi load app.
-- Trả về lỗi text nếu bị ban; null nếu OK.
create or replace function check_user_restrictions()
returns text
language sql security definer stable
set search_path = public
as $$
  select case
    when exists (
      select 1 from profiles
      where id = auth.uid() and account_banned_at is not null
    ) then 'account_banned'
    else null
  end;
$$;

grant execute on function check_user_restrictions() to authenticated;

-- =========================================================
-- PHẦN 10 — RECORD LAST SEEN IP
-- =========================================================
-- Middleware gọi RPC này mỗi lần user truy cập vào protected area để cập nhật IP cuối cùng.

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
    where id = auth.uid()
      and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
exception
  when invalid_text_representation then
    return;
end;
$$;

-- Wrapper: kiểm tra IP ban với output boolean cho middleware dễ dùng
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

grant execute on function record_profile_ip(text) to authenticated;
grant execute on function is_ip_banned(text) to authenticated, anon;
