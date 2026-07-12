-- =========================================================
-- DYNAMIC RBAC — Departments, Ranks, Mute, House point flags
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
-- An toàn khi chạy lại nhiều lần (idempotent).
-- Yêu cầu: đã chạy schema.sql + house_master.sql trước đó.
-- =========================================================

-- =========================================================
-- PHẦN 1 — DEPARTMENTS & ADMIN RANKS
-- =========================================================

-- ---------- BẢNG DEPARTMENTS ----------
create table if not exists departments (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,          -- định danh cố định: security | linguistic | admin | staff | media | judge | ex
  name text not null,                -- tên hiển thị (Global Director đổi được)
  director_title text not null,      -- vd 'Director of Security' -> có thể đổi 'Commanding Chief'
  deputy_director_title text not null,
  member_title text not null,        -- vd 'Security Officer'
  director_title_editing_enabled boolean not null default false,
  deputy_director_title_editing_enabled boolean not null default false,
  member_title_editing_enabled boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

alter table departments add column if not exists deputy_director_title text;
alter table departments add column if not exists director_title_editing_enabled boolean not null default false;
alter table departments add column if not exists deputy_director_title_editing_enabled boolean not null default false;
alter table departments add column if not exists member_title_editing_enabled boolean not null default false;

-- Seed 7 bộ phận ngang hàng mặc định
insert into departments (key, name, director_title, deputy_director_title, member_title, sort_order) values
  ('executive', 'Executive',  'Global Director',          'Deputy Global Director',     'Executive',            0),
  ('admin',     'Admin',      'Director of Admin',        'Deputy Director of Admin',   'Admin Officer',        1),
  ('security',  'Security',   'Director of Security',     'Deputy Director of Security','Security Officer',     2),
  ('linguistic','Linguistic', 'Director of Linguistic',   'Deputy Director of Linguistic', 'Linguistic Officer', 3),
  ('judge',     'Judge',      'Director of Judges',       'Deputy Director of Judges',  'Judge',                4),
  ('staff',     'Staff',      'Director of Staff',        'Deputy Director of Staff',   'Staff Member',         5),
  ('media',     'Media',      'Director of Media',        'Deputy Director of Media',   'Media Officer',        6),
  ('ex',        'Executive Protection Detail', 'Director of Ex', 'Deputy Director of Ex', 'Ex Officer',    7)
on conflict (key) do nothing;

update departments
  set deputy_director_title = case key
    when 'executive' then 'Deputy Global Director'
    when 'admin' then 'Deputy Director of Admin'
    when 'security' then 'Deputy Director of Security'
    when 'linguistic' then 'Deputy Director of Linguistic'
    when 'judge' then 'Deputy Director of Judges'
    when 'staff' then 'Deputy Director of Staff'
    when 'media' then 'Deputy Director of Media'
    when 'ex' then 'Deputy Director of Ex'
    else 'Deputy Director of Department'
  end
  where deputy_director_title is null or trim(deputy_director_title) = '';

alter table departments alter column deputy_director_title set not null;

-- ---------- ENUM: admin_rank ----------
do $$ begin
  create type admin_rank as enum ('global_director', 'director', 'deputy_director', 'member');
exception when duplicate_object then null; end $$;

alter type admin_rank add value if not exists 'deputy_director';

-- ---------- PROFILES: cột department + rank ----------
alter table profiles add column if not exists department_id uuid references departments(id);
alter table profiles add column if not exists admin_rank admin_rank;
alter table profiles add column if not exists role_title_override text;

create index if not exists idx_profiles_department on profiles(department_id);

-- Mỗi department chỉ có tối đa 1 global_director / 1 director
-- (Global Director là cấp tối cao toàn hệ thống, thường thuộc department 'executive')
create unique index if not exists idx_one_director_per_department
  on profiles(department_id) where admin_rank = 'director';

-- ---------- MIGRATION: admin_role (cũ) -> (department, rank) ----------
-- Chỉ chạy cho các admin chưa được gán rank (an toàn khi chạy lại)
do $$
declare
  dep_executive uuid;
  dep_admin uuid;
  dep_security uuid;
  dep_linguistic uuid;
  dep_judge uuid;
begin
  select id into dep_executive  from departments where key = 'executive';
  select id into dep_admin      from departments where key = 'admin';
  select id into dep_security   from departments where key = 'security';
  select id into dep_linguistic from departments where key = 'linguistic';
  select id into dep_judge      from departments where key = 'judge';

  -- director cũ -> Global Director thuộc Executive
  update profiles set admin_rank = 'global_director', department_id = dep_executive
    where user_type = 'admin' and admin_rank is null and admin_role = 'director';

  -- admin cũ -> member của Admin
  update profiles set admin_rank = 'member', department_id = dep_admin
    where user_type = 'admin' and admin_rank is null and admin_role = 'admin';

  -- security / linguistic / judge -> member của department tương ứng
  update profiles set admin_rank = 'member', department_id = dep_security
    where user_type = 'admin' and admin_rank is null and admin_role = 'security';
  update profiles set admin_rank = 'member', department_id = dep_linguistic
    where user_type = 'admin' and admin_rank is null and admin_role = 'linguistic';
  update profiles set admin_rank = 'member', department_id = dep_judge
    where user_type = 'admin' and admin_rank is null and admin_role = 'judge';

  -- fallback: bất kỳ admin nào còn sót -> member của Admin
  update profiles set admin_rank = 'member', department_id = dep_admin
    where user_type = 'admin' and admin_rank is null;
end $$;

-- =========================================================
-- PHẦN 2 — HELPER FUNCTIONS (SECURITY DEFINER)
-- =========================================================

create or replace function is_global_director()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and user_type = 'admin' and admin_rank = 'global_director'
  );
$$;

create or replace function my_admin_rank()
returns admin_rank
language sql security definer stable
set search_path = public
as $$
  select admin_rank from profiles where id = auth.uid();
$$;

create or replace function my_department_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select department_id from profiles where id = auth.uid();
$$;

-- Quy tắc quản trị:
--  - Global Director: quản lý được TẤT CẢ mọi người.
--  - Director of Department: quản lý được deputy/member cùng department, và player.
--  - Deputy Director of Department: quản lý được member cùng department, và player.
--  - Ngang hàng (member <-> member, hay khác department) KHÔNG quản lý được nhau.
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
    return false; -- không tự quản lý bản thân
  end if;

  select user_type, admin_rank, department_id into me
    from profiles where id = auth.uid();
  if me.user_type <> 'admin' then
    return false;
  end if;

  -- Global Director: toàn quyền
  if me.admin_rank::text = 'global_director' then
    return true;
  end if;

  select user_type, admin_rank, department_id into target
    from profiles where id = target_id;

  -- Mọi admin có thể quản lý player.
  -- Nhánh này cũng hỗ trợ các admin cũ chưa được migrate admin_rank.
  if target.user_type = 'player' then
    return true;
  end if;

  if me.department_id is null or target.department_id is distinct from me.department_id then
    return false;
  end if;

  -- Director: quản lý deputy/member NỘI BỘ department của mình
  if me.admin_rank::text = 'director' then
    return target.admin_rank::text in ('deputy_director', 'member');
  end if;

  -- Deputy Director: quản lý member NỘI BỘ department của mình
  if me.admin_rank::text = 'deputy_director' then
    return target.admin_rank::text = 'member';
  end if;

  return false;
end;
$$;

-- =========================================================
-- PHẦN 3 — RPC QUẢN TRỊ (gom các thao tác đổi role)
-- =========================================================

-- Đổi role admin bất kỳ, HOẶC phong player -> admin. Chỉ Global Director.
create or replace function admin_set_role(target_id uuid, dept_key text, new_rank admin_rank)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  dep_id uuid;
begin
  if not is_global_director() then
    raise exception 'Only a Global Director can change admin roles.';
  end if;

  if auth.uid() = target_id then
    raise exception 'A Global Director cannot change their own role.';
  end if;

  if new_rank::text = 'global_director' then
    raise exception 'Global Director rank must be assigned manually, not through role management.';
  end if;

  select id into dep_id from departments where key = dept_key;
  if dep_id is null then
    raise exception 'Unknown department: %', dept_key;
  end if;

  update profiles
    set user_type = 'admin',
        department_id = dep_id,
        admin_rank = new_rank,
        role_title_override = null
    where id = target_id;
end;
$$;

-- Hạ 1 admin xuống player. Global Director (bất kỳ) hoặc Director (member cùng dept).
create or replace function admin_demote_to_player(target_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not can_manage_admin(target_id) then
    raise exception 'You do not have permission to demote this admin.';
  end if;
  update profiles
    set user_type = 'player',
        admin_rank = null,
        department_id = null,
        role_title_override = null
    where id = target_id;
end;
$$;

-- Dynamic Role Renaming: đổi tên department + tiêu đề chức danh. Chỉ Global Director.
create or replace function rename_department(
  dept_id uuid,
  new_name text,
  new_director_title text,
  new_deputy_director_title text,
  new_member_title text
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_global_director() then
    raise exception 'Only a Global Director can rename departments.';
  end if;
  update departments
    set name = coalesce(nullif(trim(new_name), ''), name),
        director_title = coalesce(nullif(trim(new_director_title), ''), director_title),
        deputy_director_title = coalesce(nullif(trim(new_deputy_director_title), ''), deputy_director_title),
        member_title = coalesce(nullif(trim(new_member_title), ''), member_title)
    where id = dept_id;
end;
$$;

-- Đổi tên department, không còn đổi role title tại Permission Settings.
create or replace function rename_department_name(dept_id uuid, new_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  normalized_name text := nullif(trim(new_name), '');
begin
  if not is_global_director() then
    raise exception 'Only a Global Director can rename departments.';
  end if;

  if normalized_name is null then
    raise exception 'Department name cannot be empty.';
  end if;

  update departments
    set name = normalized_name
    where id = dept_id;
end;
$$;

grant execute on function admin_set_role(uuid, text, admin_rank) to authenticated;
grant execute on function admin_demote_to_player(uuid) to authenticated;
grant execute on function rename_department(uuid, text, text, text, text) to authenticated;
grant execute on function rename_department_name(uuid, text) to authenticated;
grant execute on function can_manage_admin(uuid) to authenticated;

-- =========================================================
-- PHẦN 4 — RLS: departments đọc công khai, siết update profiles
-- =========================================================
alter table departments enable row level security;

drop policy if exists "departments_select_all" on departments;
create policy "departments_select_all" on departments for select
  to authenticated using (true);

-- Đổi tên department chỉ qua RPC rename_department (không policy update trực tiếp)

-- Siết policy update profiles của admin: chỉ được update profile mà mình quản lý được.
-- (Việc đổi role/rank nhạy cảm đã ép qua RPC admin_set_role / admin_demote_to_player.)
drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update
  to authenticated using (can_manage_admin(id))
  with check (can_manage_admin(id));

-- =========================================================
-- REALTIME: departments để đổi tên chức danh phản ánh ngay
-- =========================================================
do $$ begin
  alter publication supabase_realtime add table departments;
exception when duplicate_object then null; end $$;
