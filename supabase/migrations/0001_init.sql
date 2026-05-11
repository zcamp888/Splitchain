-- SplitChain initial schema. Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  wallet_address text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_wallet_idx on public.profiles(wallet_address);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- AUTH NONCES (SIWE)
-- ============================================================
create table if not exists public.auth_nonces (
  wallet_address text primary key,
  nonce text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ============================================================
-- GROUPS
-- ============================================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  currency text not null default 'USD',
  cover_emoji text not null default '💸',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);

-- ============================================================
-- EXPENSES
-- ============================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  paid_by uuid not null references public.profiles(id),
  amount numeric(20,4) not null check (amount > 0),
  currency text not null default 'USD',
  description text not null,
  category text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_group_idx on public.expenses(group_id);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  share_amount numeric(20,4) not null,
  share_type text not null default 'equal' check (share_type in ('equal','exact','percent'))
);
create index if not exists expense_splits_expense_idx on public.expense_splits(expense_id);

-- ============================================================
-- SETTLEMENTS
-- ============================================================
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount numeric(20,4) not null check (amount > 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','confirmed','failed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists settlements_group_idx on public.settlements(group_id);

-- ============================================================
-- TRIGGERS for updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_groups_updated on public.groups;
create trigger trg_groups_updated before update on public.groups
  for each row execute function public.set_updated_at();

drop trigger if exists trg_expenses_updated on public.expenses;
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();

-- ============================================================
-- HELPER FUNCTION
-- ============================================================
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer stable as $$
  select exists(select 1 from public.group_members where group_id = gid and user_id = auth.uid())
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;

-- PROFILES policies
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- GROUPS policies
drop policy if exists "groups_select_members" on public.groups;
create policy "groups_select_members" on public.groups for select to authenticated
  using (public.is_group_member(id));

drop policy if exists "groups_insert_creator" on public.groups;
create policy "groups_insert_creator" on public.groups for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "groups_update_owner" on public.groups;
create policy "groups_update_owner" on public.groups for update to authenticated
  using (exists(select 1 from public.group_members where group_id = id and user_id = auth.uid() and role = 'owner'));

-- GROUP_MEMBERS policies
drop policy if exists "members_select" on public.group_members;
create policy "members_select" on public.group_members for select to authenticated
  using (public.is_group_member(group_id) or user_id = auth.uid());

drop policy if exists "members_insert" on public.group_members;
create policy "members_insert" on public.group_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists(select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid())
  );

drop policy if exists "members_delete" on public.group_members;
create policy "members_delete" on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists(select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'owner')
  );

-- EXPENSES policies
drop policy if exists "expenses_select" on public.expenses;
create policy "expenses_select" on public.expenses for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "expenses_modify" on public.expenses;
create policy "expenses_modify" on public.expenses for all to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- EXPENSE_SPLITS policies
drop policy if exists "splits_select" on public.expense_splits;
create policy "splits_select" on public.expense_splits for select to authenticated
  using (exists(select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)));

drop policy if exists "splits_modify" on public.expense_splits;
create policy "splits_modify" on public.expense_splits for all to authenticated
  using (exists(select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)))
  with check (exists(select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)));

-- SETTLEMENTS policies
drop policy if exists "settlements_select" on public.settlements;
create policy "settlements_select" on public.settlements for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "settlements_modify" on public.settlements;
create policy "settlements_modify" on public.settlements for all to authenticated
  using (public.is_group_member(group_id) and (from_user = auth.uid() or to_user = auth.uid()))
  with check (public.is_group_member(group_id) and (from_user = auth.uid() or to_user = auth.uid()));

-- ============================================================
-- REALTIME
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table public.expenses; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.expense_splits; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.settlements; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_members; exception when duplicate_object then null; end;
end $$;