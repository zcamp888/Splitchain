'use client'

import { Receipt, Trash2, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/balances'
import { useDeleteExpense } from '@/lib/hooks/useExpenses'
import { useToast } from '@/components/ui/Toaster'

export function ExpenseList({
  groupId,
  expenses,
  memberMap,
  currency,
  onAdd,
}: {
  groupId: string
  expenses: any[]
  memberMap: Map<string, any>
  currency: string
  onAdd: () => void
}) {
  const del = useDeleteExpense(groupId)
  const { push } = useToast()

  if (expenses.length === 0) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-neon-cyan/10 text-neon-cyan">
          <Receipt className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="font-display text-lg font-semibold">No expenses yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-fg-muted">Add your first expense and we'll track who owes what.</p>
        <button onClick={onAdd} className="btn-primary mt-5">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add expense
        </button>
      </div>
    )
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    try {
      await del.mutateAsync(id)
      push({ kind: 'success', message: 'Expense removed' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  return (
    <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl">
      {expenses.map((e) => {
        const payer = memberMap.get(e.paid_by)
        const payerLabel = payer?.display_name || payer?.ens_name || (payer?.wallet_address ? `${payer.wallet_address.slice(0, 6)}…${payer.wallet_address.slice(-4)}` : 'Unknown')
        const date = new Date(e.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return (
          <li key={e.id} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-elev/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-violet/10 text-neon-violet">
              <Receipt className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-balance line-clamp-1">{e.description}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                <span>{payerLabel} paid</span>
                <span>•</span>
                <span>{date}</span>
                {e.category && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{e.category}</span>
                  </>
                )}
                <span>•</span>
                <span>split {e.splits?.length || 0} ways</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="tabular font-mono font-semibold">{formatCurrency(Number(e.amount), e.currency || currency)}</div>
            </div>
            <button
              onClick={() => handleDelete(e.id)}
              className="shrink-0 rounded-lg p-2 text-fg-dim opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Delete ${e.description}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}