'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, ArrowRight, Receipt as ReceiptIcon } from 'lucide-react'
import { useGroups, useGroupDetail, useCreateExpense } from '@/lib/hooks'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toaster'
import { formatCurrency } from '@/lib/balances'

const CATEGORIES = ['food', 'travel', 'lodging', 'transport', 'entertainment', 'utilities', 'other']

function guessCategory(merchant: string | null | undefined): string {
  if (!merchant) return 'other'
  const m = merchant.toLowerCase()
  if (/cafe|coffee|restaurant|pizza|bar|grill|kitchen|bistro|diner|food|deli|bakery/.test(m)) return 'food'
  if (/hotel|inn|airbnb|lodge|resort/.test(m)) return 'lodging'
  if (/uber|lyft|taxi|metro|transit|gas|fuel|shell|chevron/.test(m)) return 'transport'
  if (/airline|airways|airport|flight/.test(m)) return 'travel'
  if (/cinema|theater|netflix|spotify|concert/.test(m)) return 'entertainment'
  if (/electric|water|internet|comcast|verizon/.test(m)) return 'utilities'
  return 'other'
}

export function ReceiptToExpenseDialog({
  open,
  onClose,
  receipt,
}: {
  open: boolean
  onClose: () => void
  receipt: any
}) {
  const parsed = receipt?.parsed_json || {}
  const [groupId, setGroupId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('other')
  const [expenseDate, setExpenseDate] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const { data: groups, isLoading: groupsLoading } = useGroups()
  const { data: groupDetail } = useGroupDetail(groupId || undefined)
  const create = useCreateExpense(groupId)
  const { push } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    setDescription(parsed.merchant || 'Receipt expense')
    setAmount(typeof parsed.total === 'number' ? parsed.total.toString() : '')
    setCategory(guessCategory(parsed.merchant))
    setExpenseDate(parsed.date || new Date().toISOString().slice(0, 10))
    setGroupId('')

    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id || null))
  }, [open, receipt])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const numericAmount = useMemo(() => {
    const n = parseFloat(amount)
    return isNaN(n) ? 0 : n
  }, [amount])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!groupId) throw new Error('Choose a group')
      if (!currentUserId) throw new Error('Not authenticated')
      if (numericAmount <= 0) throw new Error('Amount must be greater than 0')
      if (!groupDetail?.members?.length) throw new Error('Group has no members')

      const ids = groupDetail.members.map((m: any) => m.user_id)
      const cents = Math.round(numericAmount * 100)
      const base = Math.floor(cents / ids.length)
      const remainder = cents - base * ids.length
      const splits = ids.map((id: string, i: number) => ({
        user_id: id,
        share_amount: (base + (i < remainder ? 1 : 0)) / 100,
        share_type: 'equal',
      }))

      await create.mutateAsync({
        amount: numericAmount,
        description: description.trim(),
        category,
        currency: groupDetail.currency,
        expense_date: expenseDate,
        paid_by: currentUserId,
        splits,
      })

      const supabase = createSupabaseBrowserClient()
      await supabase.from('receipts').update({ /* mark linked via metadata */ }).eq('id', receipt.id)

      push({ kind: 'success', message: 'Expense created from receipt' })
      onClose()
      router.push(`/app/groups/${groupId}`)
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const selectedGroup = groups?.find((g: any) => g.id === groupId)
  const memberCount = groupDetail?.members?.length || 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-to-expense-title"
      onClick={onClose}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="receipt-to-expense-title" className="font-display text-xl font-bold tracking-tight">
              Create expense from receipt
            </h2>
            <p className="mt-1 text-xs text-fg-muted">Split this receipt equally across a group.</p>
          </div>
          <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-border-strong bg-bg-elev/40 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-cyan/10 text-neon-cyan">
              <ReceiptIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display font-semibold">{parsed.merchant || 'Receipt'}</div>
              <div className="text-xs text-fg-muted">{parsed.date || '\u2014'}</div>
            </div>
            <div className="tabular font-mono text-lg font-bold">
              {typeof parsed.total === 'number' ? formatCurrency(parsed.total, parsed.currency || 'USD') : '\u2014'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="r2e-group" className="mb-1.5 block text-xs text-fg-muted">Group</label>
            {groupsLoading ? (
              <div className="input-base flex items-center gap-2 text-fg-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading groups…
              </div>
            ) : !groups || groups.length === 0 ? (
              <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2.5 text-sm text-fg-muted">
                You don&rsquo;t have any groups yet. Create one first.
              </div>
            ) : (
              <select
                id="r2e-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                required
                className="input-base"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                <option value="">Choose a group…</option>
                {groups.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.cover_emoji} {g.name} ({g.currency})
                  </option>
                ))}
              </select>
            )}
            {selectedGroup && memberCount > 0 && (
              <p className="mt-1.5 text-xs text-fg-dim">
                Splits equally between {memberCount} member{memberCount === 1 ? '' : 's'} ·
                {' '}{formatCurrency(numericAmount / Math.max(memberCount, 1), selectedGroup.currency)} each
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="r2e-desc" className="mb-1.5 block text-xs text-fg-muted">Description</label>
              <input
                id="r2e-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={100}
                autoComplete="off"
                className="input-base"
              />
            </div>
            <div>
              <label htmlFor="r2e-amount" className="mb-1.5 block text-xs text-fg-muted">Amount</label>
              <input
                id="r2e-amount"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="input-base tabular font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="r2e-date" className="mb-1.5 block text-xs text-fg-muted">Date</label>
              <input
                id="r2e-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className="input-base"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label htmlFor="r2e-cat" className="mb-1.5 block text-xs text-fg-muted">Category</label>
              <select
                id="r2e-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-base capitalize"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={create.isPending || !groupId} className="btn-primary">
              {create.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Creating…</>
              ) : (
                <>Create expense<ArrowRight className="h-4 w-4" aria-hidden="true" /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}