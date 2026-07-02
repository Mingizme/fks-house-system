-- =========================================================
-- HOUSE SYSTEM — SUPABASE SCHEMA
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------- ENUMS ----------
do $$ begin
  create type user_type as enum ('player', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('director', 'admin', 'judge', 'security', 'linguistic');
exception when duplicate_object then null; end $$;

-- ---------- HOUSES ----------
create table if not exists houses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  color text not null,
  icon text not null,
  description text,
  created_at timestamptz default now()
);

insert into houses (name, slug, color, icon, description) values
  ('Arctic Wolves', 'arctic-wolves', 'wolves', '🐺', 'Kỷ luật, chiến thuật và sự bền bỉ giữa băng giá.'),
  ('Inferno Phoenix', 'inferno-phoenix', 'phoenix', '🔥', 'Nhiệt huyết, sức bật và tinh thần không khuất phục.'),
  ('Noble Lions', 'noble-lions', 'lions', '🦁', 'Danh dự, khí chất thủ lĩnh và lòng quả cảm.'),
  ('Ironclad Rhinos', 'ironclad-rhinos', 'rhinos', '🦏', 'Sức mạnh, sự vững chãi và tinh thần không lùi bước.')
on conflict (slug) do nothing;

-- ---------- PROFILES ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  user_type user_type not null default 'player',
  admin_role admin_role,
  house_id uuid references houses(id) on delete set null,
  avatar_emoji text default '🙂',
  created_at timestamptz default now()
);

create index if not exists idx_profiles_house on profiles(house_id);
create index if not exists idx_profiles_user_type on profiles(user_type);

-- ---------- POINT TRANSACTIONS ----------
create table if not exists point_transactions (
  id uuid primary key default uuid_generate_v4(),
  house_id uuid references houses(id) on delete cascade not null,
  admin_id uuid references profiles(id) not null,
  points integer not null,
  reason text not null,
  created_at timestamptz default now()
);

create index if not exists idx_points_house on point_transactions(house_id);

-- ---------- ANNOUNCEMENTS ----------
create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references profiles(id) not null,
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

-- ---------- DIRECT MESSAGES (player<->player and admin<->admin) ----------
create table if not exists direct_messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid references profiles(id) not null,
  recipient_id uuid references profiles(id) not null,
  content text not null,
  is_admin_chat boolean not null default false,
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists idx_dm_pair on direct_messages(sender_id, recipient_id, created_at);

-- ---------- HOUSE GROUP CHAT ----------
create table if not exists house_messages (
  id uuid primary key default uuid_generate_v4(),
  house_id uuid references houses(id) on delete cascade not null,
  sender_id uuid references profiles(id) not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_house_msg on house_messages(house_id, created_at);

-- ---------- BLOCKS ----------
create table if not exists blocks (
  id uuid primary key default uuid_generate_v4(),
  blocker_id uuid references profiles(id) not null,
  blocked_id uuid references profiles(id) not null,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

-- =========================================================
-- HELPER FUNCTIONS (security definer -> bypass RLS safely)
-- =========================================================
create or replace function is_admin()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and user_type = 'admin'
  );
$$;

create or replace function my_house_id()
returns uuid
language sql security definer stable
as $$
  select house_id from profiles where id = auth.uid();
$$;

create or replace function has_blocked(a uuid, b uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- =========================================================
-- VIEW: house points totals (real-time friendly aggregate)
-- =========================================================
create or replace view house_points as
select h.id as house_id, h.name, h.slug, h.color, h.icon,
       coalesce(sum(pt.points), 0)::bigint as total_points
from houses h
left join point_transactions pt on pt.house_id = h.id
group by h.id, h.name, h.slug, h.color, h.icon;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table houses enable row level security;
alter table profiles enable row level security;
alter table point_transactions enable row level security;
alter table announcements enable row level security;
alter table direct_messages enable row level security;
alter table house_messages enable row level security;
alter table blocks enable row level security;

-- HOUSES: mọi người đã đăng nhập đều xem được
drop policy if exists "houses_select_all" on houses;
create policy "houses_select_all" on houses for select
  to authenticated using (true);

-- PROFILES
drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select
  to authenticated using (true);

drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles for insert
  to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_self_basic" on profiles;
create policy "profiles_update_self_basic" on profiles for update
  to authenticated using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update
  to authenticated using (is_admin())
  with check (true);

-- POINT TRANSACTIONS
drop policy if exists "points_select_all" on point_transactions;
create policy "points_select_all" on point_transactions for select
  to authenticated using (true);

drop policy if exists "points_insert_admin" on point_transactions;
create policy "points_insert_admin" on point_transactions for insert
  to authenticated with check (is_admin() and admin_id = auth.uid());

-- ANNOUNCEMENTS
drop policy if exists "announcements_select_all" on announcements;
create policy "announcements_select_all" on announcements for select
  to authenticated using (true);

drop policy if exists "announcements_insert_admin" on announcements;
create policy "announcements_insert_admin" on announcements for insert
  to authenticated with check (is_admin() and admin_id = auth.uid());

drop policy if exists "announcements_delete_admin" on announcements;
create policy "announcements_delete_admin" on announcements for delete
  to authenticated using (is_admin());

-- DIRECT MESSAGES
drop policy if exists "dm_select_own" on direct_messages;
create policy "dm_select_own" on direct_messages for select
  to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "dm_insert_own" on direct_messages;
create policy "dm_insert_own" on direct_messages for insert
  to authenticated with check (
    sender_id = auth.uid()
    and not has_blocked(sender_id, recipient_id)
    and (is_admin_chat = false or (is_admin() and exists(
      select 1 from profiles p where p.id = recipient_id and p.user_type = 'admin'
    )))
  );

drop policy if exists "dm_update_own_read" on direct_messages;
create policy "dm_update_own_read" on direct_messages for update
  to authenticated using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- HOUSE MESSAGES
drop policy if exists "house_msg_select" on house_messages;
create policy "house_msg_select" on house_messages for select
  to authenticated using (is_admin() or house_id = my_house_id());

drop policy if exists "house_msg_insert" on house_messages;
create policy "house_msg_insert" on house_messages for insert
  to authenticated with check (
    sender_id = auth.uid() and (is_admin() or house_id = my_house_id())
  );

-- BLOCKS
drop policy if exists "blocks_select_own" on blocks;
create policy "blocks_select_own" on blocks for select
  to authenticated using (blocker_id = auth.uid());

drop policy if exists "blocks_insert_own" on blocks;
create policy "blocks_insert_own" on blocks for insert
  to authenticated with check (blocker_id = auth.uid());

drop policy if exists "blocks_delete_own" on blocks;
create policy "blocks_delete_own" on blocks for delete
  to authenticated using (blocker_id = auth.uid());

-- =========================================================
-- REALTIME: bật realtime cho các bảng cần update trực tiếp
-- =========================================================
alter publication supabase_realtime add table house_messages;
alter publication supabase_realtime add table direct_messages;
alter publication supabase_realtime add table point_transactions;
alter publication supabase_realtime add table announcements;
alter publication supabase_realtime add table profiles;

-- =========================================================
-- TRIGGER: tự tạo profile khi có user mới đăng ký (mặc định player, chưa có house)
-- =========================================================
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.profiles (id, username, display_name, user_type, house_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'player',
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
