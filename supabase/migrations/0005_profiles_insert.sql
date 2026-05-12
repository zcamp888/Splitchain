-- ============================================================
-- Wave 4.2 — allow authenticated users to insert their own profile
-- Run AFTER 0004_fix_rls.sql
-- ============================================================

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and id = auth.uid()
  );

-- Re-run the backfill in case any users were created since 0004
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