-- ============================================================
-- Wave 5 — activity feed + last-seen tracking
-- Run AFTER 0006_fix_groups_select.sql
-- ============================================================

-- Per-user, per-group last-seen marker. Used to compute unread counts.
create table if not exists public.group_last_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

alter table public.group_last_seen enable row level security;

drop policy if exists "last_seen_select_own" on public.group_last_seen;
create policy "last_seen_select_own" on public.group_last_seen
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "last_seen_upsert_own" on public.group_last_seen;
create policy "last_seen_upsert_own" on public.group_last_seen
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Convenience view: recent activity across all groups for the current user.
-- Combines expenses + settlements + member joins into one stream.
create or replace view public.activity_feed as
  select
    e.id::text as id,
    'expense'::text as kind,
    e.group_id,
    e.created_at as occurred_at,
    e.paid_by as actor_id,
    e.description as title,
    e.amount,
    e.currency,
    null::uuid as target_id
  from public.expenses e
  union all
  select
    s.id::text as id,
    'settlement'::text as kind,
    s.group_id,
    coalesce(s.confirmed_at, s.created_at) as occurred_at,
    s.from_user as actor_id,
    null::text as title,
    s.amount,
    s.currency,
    s.to_user as target_id
  from public.settlements s
  where s.status = 'confirmed'
  union all
  select
    (gm.group_id::text || ':' || gm.user_id::text) as id,
    'member_joined'::text as kind,
    gm.group_id,
    gm.joined_at as occurred_at,
    gm.user_id as actor_id,
    null::text as title,
    null::numeric as amount,
    null::text as currency,
    null::uuid as target_id
  from public.group_members gm;

-- The view inherits RLS from underlying tables, but grant select explicitly.
grant select on public.activity_feed to authenticated;