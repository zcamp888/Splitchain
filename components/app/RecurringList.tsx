'use client'

import { useState } from 'react'
import { Repeat, Plus, Pause, Play, Trash2, Loader2 } from 'lucide-react'
import { useGroupRecurring, useToggleRecurring, useDeleteRecurring } from '@/lib/hooks/useRecurring'
import { useToast } from '@/components/Toaster'
import { formatCurrency } from '@/lib/balances'
import { CreateRecurringDialog } from '@/components/app/CreateRecurringDialog'

function frequencyLabel(freq: string, anchor: string): string {
  if (freq === 'weekly') {
    const days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
    return `Every ${days[parseInt(anchor, 10)] || 'week'}`
  }
  if (freq === 'monthly') {
    const day = parseInt(anchor, 10)
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'
    return `Monthly on the ${day}${suffix}`
  }
  if (freq === 'yearly') {
    const [mm, dd] = anchor.split('-').map((x) => parseInt(x, 10))
    const monthName = new Date(2000, mm - 1, 1).toLocaleDateString('en-US', { month: 'long' })
    return `Yearly on ${monthName} ${dd}`
  }
  return freq
}

export function RecurringList({
  groupId,
  members,
  currency,
}: {
  groupId: string
  members: any[]
  currency: string
}) {
  const { data: rules, isLoading } = useGroupRecurring(groupId)
  const toggle = useToggleRecurring(groupId)
  const del = useDeleteRecurring(groupId)
  const { push } = useToast()
  const [showCreate, setShowCreate] = useState(false)

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await toggle.mutateAsync({ id, active: !active })
      push({ kind: 'success', message: active ? 'Paused' : 'Resumed' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring rule?')) return
    try {
      await del.mutateAsync(id)
      push({ kind: 'success', message: 'Removed' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Repeat className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
          Recurring expenses
        </h2>
        <button onClick={() => setShowCreate(true)} className="btn-ghost text-xs">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add rule
        </button>
      </div>

      {isLoading ? (
        <div className="glass flex items-center justify-center rounded-2xl p-6 text-fg-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        </div>
      ) : !rules || rules.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-fg-muted">
          No recurring rules yet. Add one for rent, subscriptions, or anything that repeats.
        </div>
      ) : (
        <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl">
          {rules.map((r) => {
            const payer = members.find((m: any) => m.user_id === r.paid_by)?.profile
            const payerLabel =
              payer?.display_name ||
              payer?.email ||
              (payer?.wallet_address ? `${payer.wallet_address.slice(0, 6)}…${payer.wallet_address.slice(-4)}` : 'Member')

            return (
              <li key={r.id} className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-elev/30 ${!r.active ? 'opacity-60' : ''}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${r.active ? 'bg-neon-cyan/10 text-neon-cyan' : 'bg-bg-elev text-fg-dim'}`}>
                  <Repeat className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium line-clamp-1">{r.description}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                    <span>{frequencyLabel(r.frequency, r.schedule_anchor)}</span>
                    <span>·</span>
                    <span>{payerLabel} pays</span>
                    <span>·</span>
                    <span>
                      next {new Date(r.next_run_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular font-mono font-semibold">{formatCurrency(r.amount, r.currency || currency)}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleToggle(r.id, r.active)}
                    className="rounded-lg p-2 text-fg-dim hover:bg-bg-elev hover:text-fg"
                    aria-label={r.active ? 'Pause rule' : 'Resume rule'}
                  >
                    {r.active ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-lg p-2 text-fg-dim hover:bg-danger/10 hover:text-danger"
                    aria-label="Delete rule"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <CreateRecurringDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        groupId={groupId}
        members={members}
        currency={currency}
      />
    </section>
  )
}