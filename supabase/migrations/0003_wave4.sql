-- ============================================================
-- Wave 4 — on-chain settlement fields
-- Run AFTER 0002_wave3.sql
-- ============================================================

alter table public.settlements
  add column if not exists chain_id integer,
  add column if not exists token_symbol text,
  add column if not exists token_address text,
  add column if not exists tx_hash text,
  add column if not exists from_address text,
  add column if not exists to_address text,
  add column if not exists method text not null default 'manual' check (method in ('manual','onchain'));

create index if not exists settlements_tx_idx on public.settlements(tx_hash);