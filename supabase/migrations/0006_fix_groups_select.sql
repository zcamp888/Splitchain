-- ============================================================
-- Wave 4.3 — fix groups INSERT...RETURNING by allowing creator
-- to SELECT their own groups (not just group_members).
-- Run AFTER 0005_profiles_insert.sql
-- ============================================================

-- The previous SELECT policy only allowed group members to see groups.
-- But INSERT...RETURNING requires SELECT permission on the new row,
-- and the creator isn't a member yet at that exact moment.
-- This was surfacing as a misleading "insert violates RLS" error.

drop policy if exists "groups_select_members" on public.groups;
create policy "groups_select_members" on public.groups
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_group_member(id)
  );

-- Same defensive pattern for UPDATE — owners can always update,
-- even via INSERT...RETURNING-style flows.
drop policy if exists "groups_update_owner" on public.groups;
create policy "groups_update_owner" on public.groups
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members
      where group_id = id and user_id = auth.uid() and role = 'owner'
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members
      where group_id = id and user_id = auth.uid() and role = 'owner'
    )
  );