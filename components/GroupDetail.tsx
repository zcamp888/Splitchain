'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  UserPlus,
  Loader2,
  Receipt as ReceiptIcon,
  Wallet,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react'
import {
  useGroupDetail,
  useGroupExpenses,
  useGroupSettlements,
  useCreateSettlement,
} from '@/lib/hooks'
import { computeBalances, suggestTransfers, formatCurrency } from '@/lib/balances'
import { ExpenseList } from '@/components/ExpenseList'
import { AddExpenseDialog } from '@/components/AddExpenseDialog'
import { AddMemberDialog } from '@/components/AddMemberDialog'
import { useToast } from '@/components/Toaster'

export function GroupDetail({ groupId }: { groupId: string }) {
  const { data: group, isLoading } = useGroupDetail(groupId)
  const { data: expenses } = useGroupExpenses(groupId)
  const { data: settlements } = useGroupSettlements(groupId)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const settle = useCreateSettlement(groupId)
  const { push } = useToast()

  const memberMap = useMemo(() => {
    const m = new Map<string, any>()
    group?.members.forEach((mem: any) => m.set(mem.user_id, mem.profile))
    return m
  }, [group])

  const { balances, transfers } = useMemo(() => {
    if (!group?.members || !expenses) return { balances: [], transfers: [] }
    const memberIds = group.members.map((m: any) => m.user_id)
    const exp = expenses.map((e: any) => ({
      id: e.id,
      paid_by: e.paid_by,
      amount: Number(e.amount),
      splits: (e.splits || []).map((s: any) => ({
        user_id: s.user_id,
        share_amount: Number(s.share_amount),
      })),
    }))
    const set = (settlements || []).map((s: any) => ({
      from_user: s.from_user,
      to_user: s.to_user,
      amount: Number(s.amount),
      status: s.status,
    }))
    const b = computeBalances(memberIds, exp, set)
    const t = suggestTransfers(b)
    return { balances: b, transfers: t }
  }, [group, expenses, settlements])

  const handleMarkPaid = async (from: string, to: string, amount: number) => {
    try {
      await settle.mutateAsync({
        from_user: from,
        to_user: to,
        amount,
        currency: group?.currency || 'USD',
      })
      push({ kind: 'success', message: 'Marked as settled' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-fg-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="ml-2 text-sm">Loading group…</span>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <h2 className="font-display text-xl font-semibold">Group not found</h2>
        <Link href="/app" className="btn-ghost mt-4 inline-flex">
          Back to groups
        </Link>
      </div>
    )
  }

  const totalSpent = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount), 0)

  return (
    <div>
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All groups
      </Link>

      <header className="glass-strong rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="text-5xl" aria-hidden="true">
              {group.cover_emoji}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-balance">
                {group.name}
              </h1>
              {group.description && (
                <p className="mt-1 text-sm text-fg-muted text-pretty">{group.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-fg-dim">
                <span>
                  {group.members.length} member{group.members.length === 1 ? '' : 's'}
                </span>
                <span>•</span>
                <span>{group.currency}</span>
                <span>•</span>
                <span className="tabular">
                  {formatCurrency(totalSpent, group.currency)} total
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAddMember(true)} className="btn-ghost">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add member
            </button>
            <button onClick={() => setShowAddExpense(true)} className="btn-primary">
              <ReceiptIcon className="h-4 w-4" aria-hidden="true" />
              Add expense
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {group.members.map((m: any) => {
            const bal = balances.find((b) => b.user_id === m.user_id)?.net || 0
            const positive = bal > 0.01
            const negative = bal < -0.01
            const wallet = m.profile?.wallet_address
            const label =
              m.profile?.display_name ||
              m.profile?.email ||
              (wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'Member')
            return (
              <div
                key={m.user_id}
                className="flex items-center gap-2 rounded-full border border-border-strong bg-bg-elev/60 px-3 py-1.5 text-xs"
              >
                <span className="font-medium">{label}</span>
                <span
                  className={`tabular font-mono ${positive ? 'text-success' : negative ? 'text-danger' : 'text-fg-dim'}`}
                >
                  {positive && '+'}
                  {formatCurrency(bal, group.currency)}
                </span>
              </div>
            )
          })}
        </div>
      </header>

      {transfers.length > 0 && (
        <section className="mt-6 glass rounded-2xl p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Wallet className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
            Suggested settlements
          </h2>
          <p className="mt-1 text-sm text-fg-muted">Minimum transfers to settle the group.</p>
          <ul className="mt-4 space-y-2">
            {transfers.map((t, i) => {
              const from = memberMap.get(t.from)
              const to = memberMap.get(t.to)
              const fromLabel = from?.display_name || from?.email || 'Member'
              const toLabel = to?.display_name || to?.email || 'Member'
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-elev/40 px-4 py-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{fromLabel}</span>
                    <span className="text-fg-dim">pays</span>
                    <span className="truncate font-medium">{toLabel}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular font-mono font-semibold text-neon-lime">
                      {formatCurrency(t.amount, group.currency)}
                    </span>
                    <button
                      onClick={() => handleMarkPaid(t.from, t.to, t.amount)}
                      disabled={settle.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-strong bg-bg-card px-2.5 py-1 text-xs hover:border-success/40 hover:text-success disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Mark paid
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <TrendingUp className="h-4 w-4 text-neon-violet" aria-hidden="true" />
          Recent expenses
        </h2>
        <ExpenseList
          groupId={groupId}
          expenses={expenses || []}
          memberMap={memberMap}
          currency={group.currency}
          onAdd={() => setShowAddExpense(true)}
        />
      </section>

      <AddMemberDialog
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        groupId={groupId}
      />
      <AddExpenseDialog
        open={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        groupId={groupId}
        members={group.members}
        currency={group.currency}
      />
    </div>
  )
}