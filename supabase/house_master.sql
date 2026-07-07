-- =========================================================
-- HOUSE MASTER / VICE MASTER + HOUSE ANNOUNCEMENTS
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
-- (an toàn khi chạy lại nhiều lần)
-- =========================================================

-- ---------- ENUM: house_role ----------
do $$ begin
  create type house_role as enum ('master', 'vice');
exception when duplicate_object then null; end $$;

-- ---------- PROFILE: house_role column ----------
alter table profiles add column if not exists house_role house_role;

-- Mỗi house chỉ có tối đa 1 master và 1 vice
create unique index if not exists idx_one_master_per_house
  on profiles(house_id) where house_role = 'master';
create unique index if not exists idx_one_vice_per_house
  on profiles(house_id) where house_role = 'vice';

-- ---------- HELPER: house_role của user hiện tại ----------
create or replace function my_house_role()
returns house_role
language sql security definer stable
set search_path = public
as $$
  select house_role from profiles where id = auth.uid();
$$;

-- ---------- GUARD: chặn user tự đổi house_role của chính mình ----------
create or replace function protect_profile_self_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id then
    if new.email is distinct from old.email
       or new.username is distinct from old.username
       or new.user_type is distinct from old.user_type
       or new.admin_role is distinct from old.admin_role
       or new.house_id is distinct from old.house_id
       or new.house_role is distinct from old.house_role then
      raise exception 'Protected profile fields cannot be changed from user settings.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profile_self_update_guard on profiles;
create trigger profile_self_update_guard
  before update on profiles
  for each row execute procedure protect_profile_self_update();

-- ---------- TRIGGER: tự gỡ chức vụ khi đổi/rời house ----------
create or replace function clear_house_role_on_house_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.house_id is distinct from old.house_id then
    new.house_role = null;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_clear_house_role on profiles;
create trigger profile_clear_house_role
  before update of house_id on profiles
  for each row execute procedure clear_house_role_on_house_change();

-- ---------- RPC: bổ nhiệm master/vice (admin-only, đổi ngôi nguyên tử) ----------
create or replace function set_house_leader(target_id uuid, new_role house_role)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  target_house uuid;
begin
  if not is_admin() then
    raise exception 'Only admins can appoint house leaders.';
  end if;

  select house_id into target_house from profiles where id = target_id;
  if target_house is null then
    raise exception 'Player is not assigned to a house.';
  end if;

  -- Gỡ người đang giữ chức vụ này trong cùng house (nếu có, và không phải target)
  update profiles
    set house_role = null
    where house_id = target_house and house_role = new_role and id <> target_id;

  update profiles set house_role = new_role where id = target_id;
end;
$$;

create or replace function clear_house_leader(target_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can change house leaders.';
  end if;
  update profiles set house_role = null where id = target_id;
end;
$$;

grant execute on function set_house_leader(uuid, house_role) to authenticated;
grant execute on function clear_house_leader(uuid) to authenticated;

-- ---------- HOUSE ANNOUNCEMENTS ----------
create table if not exists house_announcements (
  id uuid primary key default uuid_generate_v4(),
  house_id uuid references houses(id) on delete cascade not null,
  author_id uuid references profiles(id) not null,
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_house_ann on house_announcements(house_id, created_at);

alter table house_announcements enable row level security;

-- Xem: admin hoặc thành viên cùng house
drop policy if exists "house_ann_select" on house_announcements;
create policy "house_ann_select" on house_announcements for select
  to authenticated using (is_admin() or house_id = my_house_id());

-- Đăng: admin, hoặc master/vice của chính house đó
drop policy if exists "house_ann_insert" on house_announcements;
create policy "house_ann_insert" on house_announcements for insert
  to authenticated with check (
    is_admin()
    or (author_id = auth.uid() and house_id = my_house_id() and my_house_role() in ('master', 'vice'))
  );

-- Sửa/xóa: admin hoặc chính người đăng
drop policy if exists "house_ann_update" on house_announcements;
create policy "house_ann_update" on house_announcements for update
  to authenticated using (is_admin() or author_id = auth.uid())
  with check (is_admin() or author_id = auth.uid());

drop policy if exists "house_ann_delete" on house_announcements;
create policy "house_ann_delete" on house_announcements for delete
  to authenticated using (is_admin() or author_id = auth.uid());

-- ---------- HOUSE CHAT: cho phép master/vice kiểm duyệt (soft-delete) ----------
drop policy if exists "house_msg_update_leader" on house_messages;
create policy "house_msg_update_leader" on house_messages for update
  to authenticated using (
    house_id = my_house_id() and my_house_role() in ('master', 'vice')
  )
  with check (
    house_id = my_house_id() and my_house_role() in ('master', 'vice')
  );

-- ---------- REALTIME ----------
do $$ begin
  alter publication supabase_realtime add table house_announcements;
exception when duplicate_object then null; end $$;
