-- ============================================================
-- Wave 6 — recurring expense templates + materialization
-- Run AFTER 0007_activity.sql
-- ============================================================

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  paid_by uuid not null references public.profiles(id) on delete cascade,
  amount numeric(20,4) not null check (amount > 0),
  currency text not null default 'USD',
  description text not null,
  category text,
  -- 'monthly' | 'weekly' | 'yearly'
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  -- For monthly: day-of-month (1-28). For weekly: day-of-week (0=Sun..6=Sat). For yearly: month-day "MM-DD".
  schedule_anchor text not null,
  -- JSONB array: [{ "user_id": uuid, "share_amount": number, "share_type": "equal"|"exact" }]
  splits_template jsonb not null,
  next_run_at date not null,
  last_run_at date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_group_idx on public.recurring_expenses(group_id);
create index if not exists recurring_next_run_idx on public.recurring_expenses(next_run_at) where active = true;

drop trigger if exists trg_recurring_updated on public.recurring_expenses;
create trigger trg_recurring_updated before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

alter table public.recurring_expenses enable row level security;

drop policy if exists "recurring_select_members" on public.recurring_expenses;
create policy "recurring_select_members" on public.recurring_expenses
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "recurring_modify_members" on public.recurring_expenses;
create policy "recurring_modify_members" on public.recurring_expenses
  for all to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- ============================================================
-- Materialization function — generates real expenses from due templates
-- Called opportunistically from the app (no cron needed)
-- ============================================================
create or replace function public.run_due_recurring_expenses()
returns integer
language plpgsql
security definer
as $$
declare
  r record;
  new_expense_id uuid;
  split jsonb;
  generated_count integer := 0;
  next_date date;
begin
  for r in
    select * from public.recurring_expenses
    where active = true
      and next_run_at <= current_date
      -- Only run rules for groups the calling user is a member of
      and exists (
        select 1 from public.group_members gm
        where gm.group_id = recurring_expenses.group_id
          and gm.user_id = auth.uid()
      )
    limit 50
  loop
    -- Create the expense
    insert into public.expenses (group_id, paid_by, amount, currency, description, category, expense_date)
    values (r.group_id, r.paid_by, r.amount, r.currency, r.description, r.category, r.next_run_at)
    returning id into new_expense_id;

    -- Create the splits
    for split in select * from jsonb_array_elements(r.splits_template)
    loop
      insert into public.expense_splits (expense_id, user_id, share_amount, share_type)
      values (
        new_expense_id,
        (split->>'user_id')::uuid,
        (split->>'share_amount')::numeric,
        coalesce(split->>'share_type', 'equal')
      );
    end loop;

    -- Compute next run
    next_date := case r.frequency
      when 'weekly' then r.next_run_at + interval '7 days'
      when 'monthly' then r.next_run_at + interval '1 month'
      when 'yearly' then r.next_run_at + interval '1 year'
    end;

    update public.recurring_expenses
    set last_run_at = r.next_run_at,
        next_run_at = next_date
    where id = r.id;

    generated_count := generated_count + 1;
  end loop;

  return generated_count;
end $$;

grant execute on function public.run_due_recurring_expenses() to authenticated;