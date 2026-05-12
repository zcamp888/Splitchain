-- ============================================================
-- Wave 3 — invites, receipts, bills
-- Run AFTER 0001_init.sql
-- ============================================================

-- ============================================================
-- GROUP INVITES (shareable tokens + direct invites)
-- ============================================================
create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  invited_wallet text,
  invited_email text,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists group_invites_token_idx on public.group_invites(token);
create index if not exists group_invites_group_idx on public.group_invites(group_id);
create index if not exists group_invites_wallet_idx on public.group_invites(invited_wallet);

alter table public.group_invites enable row level security;

drop policy if exists "invites_select_members_or_token" on public.group_invites;
create policy "invites_select_members_or_token" on public.group_invites for select to authenticated
  using (public.is_group_member(group_id) or created_by = auth.uid());

drop policy if exists "invites_insert_members" on public.group_invites;
create policy "invites_insert_members" on public.group_invites for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists "invites_update_accept" on public.group_invites;
create policy "invites_update_accept" on public.group_invites for update to authenticated
  using (true) with check (true);

drop policy if exists "invites_delete_owner" on public.group_invites;
create policy "invites_delete_owner" on public.group_invites for delete to authenticated
  using (created_by = auth.uid() or exists(
    select 1 from public.group_members where group_id = group_invites.group_id and user_id = auth.uid() and role = 'owner'
  ));

-- ============================================================
-- RECEIPTS (image uploads + GPT-4o parsed JSON)
-- ============================================================
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  expense_id uuid references public.expenses(id) on delete set null,
  storage_path text not null,
  parsed_json jsonb,
  ocr_status text not null default 'pending' check (ocr_status in ('pending','success','failed')),
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists receipts_uploader_idx on public.receipts(uploaded_by);
create index if not exists receipts_expense_idx on public.receipts(expense_id);

alter table public.receipts enable row level security;

drop policy if exists "receipts_select_own" on public.receipts;
create policy "receipts_select_own" on public.receipts for select to authenticated
  using (uploaded_by = auth.uid());

drop policy if exists "receipts_insert_own" on public.receipts;
create policy "receipts_insert_own" on public.receipts for insert to authenticated
  with check (uploaded_by = auth.uid());

drop policy if exists "receipts_update_own" on public.receipts;
create policy "receipts_update_own" on public.receipts for update to authenticated
  using (uploaded_by = auth.uid()) with check (uploaded_by = auth.uid());

drop policy if exists "receipts_delete_own" on public.receipts;
create policy "receipts_delete_own" on public.receipts for delete to authenticated
  using (uploaded_by = auth.uid());

-- Storage bucket for receipt images
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_storage_select_own" on storage.objects;
create policy "receipts_storage_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_storage_insert_own" on storage.objects;
create policy "receipts_storage_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_storage_delete_own" on storage.objects;
create policy "receipts_storage_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- BILLS (personal recurring expenses)
-- ============================================================
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric(20,4) not null check (amount > 0),
  currency text not null default 'USD',
  due_date date not null,
  recurrence text not null default 'once' check (recurrence in ('once','weekly','monthly','yearly')),
  category text,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bills_user_idx on public.bills(user_id);
create index if not exists bills_due_idx on public.bills(due_date);

drop trigger if exists trg_bills_updated on public.bills;
create trigger trg_bills_updated before update on public.bills
  for each row execute function public.set_updated_at();

alter table public.bills enable row level security;

drop policy if exists "bills_select_own" on public.bills;
create policy "bills_select_own" on public.bills for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "bills_modify_own" on public.bills;
create policy "bills_modify_own" on public.bills for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());