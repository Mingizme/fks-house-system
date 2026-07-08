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
  member_title text not null,        -- vd 'Security Officer'
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Seed 7 bộ phận ngang hàng mặc định
insert into departments (key, name, director_title, member_title, sort_order) values
  ('executive', 'Executive',  'Global Director',          'Executive',            0),
  ('admin',     'Admin',      'Director of Admin',        'Admin Officer',        1),
  ('security',  'Security',   'Director of Security',     'Security Officer',     2),
  ('linguistic','Linguistic', 'Director of Linguistic',   'Linguistic Officer',   3),
  ('judge',     'Judge',      'Director of Judges',       'Judge',                4),
  ('staff',     'Staff',      'Director of Staff',        'Staff Member',         5),
  ('media',     'Media',      'Director of Media',        'Media Officer',        6),
  ('ex',        'Executive Protection Detail', 'Director of Ex', 'Ex Officer',    7)
on conflict (key) do nothing;

-- ---------- ENUM: admin_rank ----------
do $$ begin
  create type admin_rank as enum ('global_director', 'director', 'member');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES: cột department + rank ----------
alter table profiles add column if not exists department_id uuid references departments(id);
alter table profiles add column if not exists admin_rank admin_rank;

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
--  - Director of Department: quản lý được member (rank='member') cùng department, và player.
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
  if me.admin_rank = 'global_director' then
    return true;
  end if;

  select user_type, admin_rank, department_id into target
    from profiles where id = target_id;

  -- Director: quản lý player, hoặc member NỘI BỘ department của mình
  if me.admin_rank = 'director' then
    if target.user_type = 'player' then
      return true;
    end if;
    if target.admin_rank = 'member' and target.department_id = me.department_id then
      return true;
    end if;
    return false;
  end if;

  -- Member thường: chỉ quản lý được player (điều phối house), không quản lý admin khác
  if me.admin_rank = 'member' and target.user_type = 'player' then
    return true;
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

  select id into dep_id from departments where key = dept_key;
  if dep_id is null then
    raise exception 'Unknown department: %', dept_key;
  end if;

  update profiles
    set user_type = 'admin',
        department_id = dep_id,
        admin_rank = new_rank
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
        department_id = null
    where id = target_id;
end;
$$;

-- Dynamic Role Renaming: đổi tên department + tiêu đề chức danh. Chỉ Global Director.
create or replace function rename_department(
  dept_id uuid,
  new_name text,
  new_director_title text,
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
        member_title = coalesce(nullif(trim(new_member_title), ''), member_title)
    where id = dept_id;
end;
$$;

grant execute on function admin_set_role(uuid, text, admin_rank) to authenticated;
grant execute on function admin_demote_to_player(uuid) to authenticated;
grant execute on function rename_department(uuid, text, text, text) to authenticated;
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
