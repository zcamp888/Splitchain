'use client'

import { Receipt, Trash2, Plus, Pencil, Zap } from 'lucide-react'
import { formatCurrency } from '@/lib/balances'
import { displayName } from '@/lib/displayName'
import { useDeleteExpense } from '@/lib/hooks'
import { useToast } from '@/components/Toaster'

export function ExpenseList({
  groupId,
  expenses,
  memberMap,
  currency,
  onAdd,
  onEdit,
  onClaim,
  currentUserId,
  hasActiveVault,
}: {
  groupId: string
  expenses: any[]
  memberMap: Map<string, any>
  currency: string
  onAdd: () => void
  onEdit: (expense: any) => void
  onClaim?: (expense: any) => void
  currentUserId?: string | null
  hasActiveVault?: boolean
}) {
  const del = useDeleteExpense(groupId)
  const { push } = useToast()

  if (expenses.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center sm:p-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-neon-cyan/10 text-neon-cyan">
          <Receipt className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="font-display text-lg font-semibold">No expenses yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-fg-muted">
          Add your first expense and we&rsquo;ll track who owes what.
        </p>
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
      {expenses.map((e: any) => {
        const payer = memberMap.get(e.paid_by)
        const iPaid = currentUserId && e.paid_by === currentUserId
        const payerLabel = iPaid ? 'You' : displayName(payer)
        const date = new Date(e.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const canClaim = !!(hasActiveVault && iPaid && onClaim)

        return (
          <li key={e.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-elev/30 sm:gap-4 sm:px-5 sm:py-4">
            <button
              onClick={() => onEdit(e)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-violet/10 text-neon-violet transition-colors active:scale-95 hover:bg-neon-violet/20"
              aria-label={`Edit ${e.description}`}
            >
              <Receipt className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => onEdit(e)}
              className="min-w-0 flex-1 text-left"
              aria-label={`Edit ${e.description}`}
            >
              <div className="font-medium text-balance line-clamp-1">{e.description}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-muted">
                <span className="truncate max-w-[120px] sm:max-w-none">{payerLabel} paid</span>
                <span aria-hidden="true">·</span>
                <span>{date}</span>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">split {e.splits?.length || 0}</span>
              </div>
            </button>
            <div className="shrink-0 text-right">
              <div className="tabular font-mono text-sm font-semibold sm:text-base">
                {formatCurrency(Number(e.amount), e.currency || currency)}
              </div>
            </div>
            <div className="flex shrink-0 gap-0.5">
              {canClaim && (
                <button
                  onClick={() => onClaim!(e)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-neon-violet/10 px-2.5 text-xs font-medium text-neon-violet transition-colors active:scale-95 hover:bg-neon-violet/20"
                  aria-label={`Claim ${e.description} from vault`}
                >
                  <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Claim</span>
                </button>
              )}
              <button
                onClick={() => onEdit(e)}
                className="btn-icon text-fg-dim hover:bg-bg-elev hover:text-fg lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                aria-label={`Edit ${e.description}`}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => handleDelete(e.id)}
                className="btn-icon text-fg-dim hover:bg-danger/10 hover:text-danger lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                aria-label={`Delete ${e.description}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}