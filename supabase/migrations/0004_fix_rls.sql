-- ============================================================
-- Wave 4.1 — RLS fix for group creation
-- Run AFTER 0003_wave4.sql
-- ============================================================

-- Ensure every auth.users row has a matching profiles row.
-- Wallet auth creates users via admin API which sometimes races
-- with the handle_new_user trigger; backfill any missing profiles.
insert into public.profiles (id, email, display_name, wallet_address)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'display_name',
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  u.raw_user_meta_data->>'wallet_address'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Recreate the groups insert policy with a more explicit check.
-- The previous version was correct, but we add a defensive
-- "auth.uid() is not null" guard so failures surface clearly.
drop policy if exists "groups_insert_creator" on public.groups;
create policy "groups_insert_creator" on public.groups
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
  );

-- Same defensive check for group_members insert — the bootstrap
-- "creator adds self as owner" path must always succeed.
drop policy if exists "members_insert" on public.group_members;
create policy "members_insert" on public.group_members
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.group_members gm
        where gm.group_id = group_members.group_id
          and gm.user_id = auth.uid()
      )
    )
  );