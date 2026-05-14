'use client'

import { useMemo } from 'react'
import { Zap, Receipt as ReceiptIcon } from 'lucide-react'
import { useGroupExpenses } from '@/lib/hooks'
import { useVaultClaims } from '@/lib/hooks/useVaults'
import type { Vault } from '@/lib/hooks/useVaults'
import { formatCurrency } from '@/lib/balances'

export function ClaimableExpenses({
  vault,
  currentUserId,
  onClaim,
}: {
  vault: Vault
  currentUserId: string | null
  onClaim: (expense: { id: string; description: string; amount: number; currency: string }) => void
}) {
  const { data: expenses } = useGroupExpenses(vault.group_id)
  const { data: claims } = useVaultClaims(vault.id)

  // Build a set of expense_ids that have already been claimed (in full or part)
  const claimedExpenseIds = useMemo(() => {
    const ids = new Set<string>()
    ;(claims || []).forEach((c: any) => {
      if (c.expense_id) ids.add(c.expense_id)
    })
    return ids
  }, [claims])

  // Filter: expenses paid by current user, in the last 14 days, not yet claimed
  const claimable = useMemo(() => {
    if (!currentUserId || !expenses) return []
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    const cutoffISO = cutoff.toISOString().slice(0, 10)

    return expenses
      .filter((e: any) => e.paid_by === currentUserId)
      .filter((e: any) => e.expense_date >= cutoffISO)
      .filter((e: any) => !claimedExpenseIds.has(e.id))
      .slice(0, 3)
  }, [expenses, currentUserId, claimedExpenseIds])

  if (vault.status !== 'active' || claimable.length === 0) return null

  const totalClaimable = claimable.reduce((s: number, e: any) => s + Number(e.amount), 0)

  return (
    <div className="mt-4 rounded-2xl border border-neon-violet/30 bg-gradient-to-br from-neon-violet/5 to-neon-cyan/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-neon-violet">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          Claimable by you
        </div>
        <div className="tabular font-mono text-xs text-fg-muted">
          {formatCurrency(totalClaimable, 'USD')}
        </div>
      </div>
      <ul className="space-y-1.5">
        {claimable.map((e: any) => (
          <li key={e.id} className="flex items-center gap-2 rounded-lg bg-bg-elev/40 px-2.5 py-2">
            <ReceiptIcon className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{e.description}</div>
              <div className="text-[10px] text-fg-dim">
                {new Date(e.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
            <span className="shrink-0 tabular font-mono text-xs">
              {formatCurrency(Number(e.amount), e.currency)}
            </span>
            <button
              onClick={() => onClaim({
                id: e.id,
                description: e.description,
                amount: Number(e.amount),
                currency: e.currency,
              })}
              className="shrink-0 rounded-md bg-gradient-to-br from-neon-violet to-neon-cyan px-2 py-1 text-[10px] font-medium text-bg shadow-sm transition-shadow hover:shadow-neon-violet/30"
              aria-label={`Claim ${e.description}`}
            >
              Claim
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}