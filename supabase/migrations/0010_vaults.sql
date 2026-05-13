-- ============================================================
-- Wave 7 — On-chain group vaults (cache of contract state)
-- Run AFTER 0009_push.sql
--
-- The smart contract is the source of truth. These tables are
-- a fast-access cache so the UI doesn't need to hit the RPC for
-- every render. Chain events keep them in sync (indexed via
-- API routes that watch logs).
-- ============================================================

create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  -- The vault clone address on-chain
  contract_address text not null unique,
  -- The deployment chain
  chain_id integer not null,
  -- The ERC20 token held by the vault (USDC for v1)
  token_address text not null,
  token_symbol text not null default 'USDC',
  token_decimals integer not null default 6,
  -- Per-member target deposit (informational, in major units)
  target_per_member numeric(20,4) not null,
  -- Human-readable label ("Ski trip 2025")
  name text not null,
  -- The wallet that owns the vault on-chain (can close it)
  owner_address text not null,
  -- Lifecycle
  status text not null default 'active' check (status in ('active','closed')),
  closed_at timestamptz,
  close_tx_hash text,
  -- Deploy provenance
  created_by uuid not null references public.profiles(id) on delete cascade,
  deploy_tx_hash text not null,
  deployed_at timestamptz not null default now(),
  -- Cached aggregates (refreshed from chain events)
  total_deposited numeric(20,4) not null default 0,
  total_claimed numeric(20,4) not null default 0,
  remaining_balance numeric(20,4) not null default 0,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vaults_group_idx on public.vaults(group_id);
create index if not exists vaults_contract_idx on public.vaults(contract_address);
create index if not exists vaults_chain_idx on public.vaults(chain_id);
create index if not exists vaults_status_idx on public.vaults(status);

drop trigger if exists trg_vaults_updated on public.vaults;
create trigger trg_vaults_updated before update on public.vaults
  for each row execute function public.set_updated_at();

-- ============================================================
-- VAULT MEMBERS — snapshot of who was eligible at deploy time
-- (Contract enforces this; we mirror for fast UI lookups.)
-- ============================================================
create table if not exists public.vault_members (
  vault_id uuid not null references public.vaults(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_address text not null,
  primary key (vault_id, user_id)
);

create index if not exists vault_members_wallet_idx on public.vault_members(wallet_address);

-- ============================================================
-- VAULT DEPOSITS — one row per on-chain Deposited event
-- ============================================================
create table if not exists public.vault_deposits (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  -- Depositor wallet (resolved to user_id when we recognize them)
  member_address text not null,
  member_user_id uuid references public.profiles(id) on delete set null,
  amount numeric(20,4) not null check (amount > 0),
  -- On-chain provenance
  tx_hash text not null,
  block_number bigint not null,
  log_index integer not null,
  occurred_at timestamptz not null default now(),
  -- Dedup guard: same log can never insert twice
  unique (tx_hash, log_index)
);

create index if not exists vault_deposits_vault_idx on public.vault_deposits(vault_id);
create index if not exists vault_deposits_member_idx on public.vault_deposits(member_user_id);

-- ============================================================
-- VAULT CLAIMS — one row per on-chain ReimbursementClaimed event
-- ============================================================
create table if not exists public.vault_claims (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  claimer_address text not null,
  claimer_user_id uuid references public.profiles(id) on delete set null,
  amount numeric(20,4) not null check (amount > 0),
  -- The off-chain expense this claim reimburses (bytes32 in contract)
  expense_id_bytes32 text not null,
  expense_id uuid references public.expenses(id) on delete set null,
  -- On-chain provenance
  tx_hash text not null,
  block_number bigint not null,
  log_index integer not null,
  occurred_at timestamptz not null default now(),
  unique (tx_hash, log_index)
);

create index if not exists vault_claims_vault_idx on public.vault_claims(vault_id);
create index if not exists vault_claims_claimer_idx on public.vault_claims(claimer_user_id);
create index if not exists vault_claims_expense_idx on public.vault_claims(expense_id);

-- ============================================================
-- VAULT REFUNDS — one row per on-chain Refunded event (close)
-- ============================================================
create table if not exists public.vault_refunds (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  member_address text not null,
  member_user_id uuid references public.profiles(id) on delete set null,
  amount numeric(20,4) not null check (amount >= 0),
  tx_hash text not null,
  block_number bigint not null,
  log_index integer not null,
  occurred_at timestamptz not null default now(),
  unique (tx_hash, log_index)
);

create index if not exists vault_refunds_vault_idx on public.vault_refunds(vault_id);
create index if not exists vault_refunds_member_idx on public.vault_refunds(member_user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Vaults inherit visibility from their group: any group member
-- can read the vault and all its events. Only the vault creator
-- (who also deployed on-chain) can insert the initial vault row.
-- Event tables are write-only via service role (indexer).
-- ============================================================

alter table public.vaults enable row level security;
alter table public.vault_members enable row level security;
alter table public.vault_deposits enable row level security;
alter table public.vault_claims enable row level security;
alter table public.vault_refunds enable row level security;

-- VAULTS
drop policy if exists "vaults_select_members" on public.vaults;
create policy "vaults_select_members" on public.vaults
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "vaults_insert_creator" on public.vaults;
create policy "vaults_insert_creator" on public.vaults
  for insert to authenticated
  with check (
    public.is_group_member(group_id)
    and created_by = auth.uid()
  );

-- Updates only happen via service role (indexer syncs chain state).
-- No update policy means authenticated users cannot update.

-- VAULT MEMBERS
drop policy if exists "vault_members_select" on public.vault_members;
create policy "vault_members_select" on public.vault_members
  for select to authenticated
  using (
    exists (
      select 1 from public.vaults v
      where v.id = vault_members.vault_id
        and public.is_group_member(v.group_id)
    )
  );

drop policy if exists "vault_members_insert" on public.vault_members;
create policy "vault_members_insert" on public.vault_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.vaults v
      where v.id = vault_members.vault_id
        and v.created_by = auth.uid()
    )
  );

-- VAULT DEPOSITS / CLAIMS / REFUNDS — read-only for members
drop policy if exists "vault_deposits_select" on public.vault_deposits;
create policy "vault_deposits_select" on public.vault_deposits
  for select to authenticated
  using (
    exists (
      select 1 from public.vaults v
      where v.id = vault_deposits.vault_id
        and public.is_group_member(v.group_id)
    )
  );

drop policy if exists "vault_claims_select" on public.vault_claims;
create policy "vault_claims_select" on public.vault_claims
  for select to authenticated
  using (
    exists (
      select 1 from public.vaults v
      where v.id = vault_claims.vault_id
        and public.is_group_member(v.group_id)
    )
  );

drop policy if exists "vault_refunds_select" on public.vault_refunds;
create policy "vault_refunds_select" on public.vault_refunds
  for select to authenticated
  using (
    exists (
      select 1 from public.vaults v
      where v.id = vault_refunds.vault_id
        and public.is_group_member(v.group_id)
    )
  );

-- ============================================================
-- REALTIME — push vault state changes to subscribed UIs
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table public.vaults; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.vault_deposits; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.vault_claims; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.vault_refunds; exception when duplicate_object then null; end;
end $$;