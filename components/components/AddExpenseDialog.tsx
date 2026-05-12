'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useCreateExpense, useUpdateExpense } from '@/lib/hooks'
import { useToast } from '@/components/Toaster'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const CATEGORIES = ['food', 'travel', 'lodging', 'transport', 'entertainment', 'utilities', 'other']

type Prefill = {
  id?: string
  amount?: number
  description?: string
  category?: string
  expense_date?: string
  paid_by?: string
  splits?: { user_id: string; share_amount: number; share_type?: string }[]
}

export function AddExpenseDialog({
  open,
  onClose,
  groupId,
  members,
  currency,
  prefill,
  editId,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  members: any[]
  currency: string
  prefill?: Prefill
  editId?: string
}) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('food')
  const [paidBy, setPaidBy] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [splitMode, setSplitMode] = useState<'equal' | 'exact'>('equal')
  const [includedMembers, setIncludedMembers] = useState<Set<string>>(new Set())
  const [exactSplits, setExactSplits] = useState<Record<string, string>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const create = useCreateExpense(groupId)
  const update = useUpdateExpense(groupId)
  const { push } = useToast()

  const isEdit = !!editId

  useEffect(() => {
    if (!open) return
    setAmount(prefill?.amount ? prefill.amount.toString() : '')
    setDescription(prefill?.description || '')
    setCategory(prefill?.category || 'food')
    setExpenseDate(prefill?.expense_date || new Date().toISOString().slice(0, 10))
    setSplitMode('equal')

    if (prefill?.splits && prefill.splits.length > 0) {
      setIncludedMembers(new Set(prefill.splits.map((s) => s.user_id)))
      const allEqual = prefill.splits.every((s) => s.share_type === 'equal')
      if (!allEqual) {
        setSplitMode('exact')
        const map: Record<string, string> = {}
        prefill.splits.forEach((s) => { map[s.user_id] = s.share_amount.toFixed(2) })
        setExactSplits(map)
      } else {
        setExactSplits({})
      }
    } else {
      setIncludedMembers(new Set(members.map((m: any) => m.user_id)))
      setExactSplits({})
    }

    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id)
        setPaidBy(prefill?.paid_by || user.id)
      }
    })
  }, [open, members, prefill])

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

  const equalShare = useMemo(() => {
    if (!numericAmount || includedMembers.size === 0) return 0
    return Math.floor((numericAmount * 100) / includedMembers.size) / 100
  }, [numericAmount, includedMembers])

  const exactTotal = useMemo(() => {
    return Object.entries(exactSplits)
      .filter(([uid]) => includedMembers.has(uid))
      .reduce((s, [, v]) => s + (parseFloat(v) || 0), 0)
  }, [exactSplits, includedMembers])

  if (!open) return null

  const toggleMember = (uid: string) => {
    setIncludedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!paidBy) throw new Error('Choose who paid')
      if (numericAmount <= 0) throw new Error('Amount must be greater than 0')
      if (includedMembers.size === 0) throw new Error('Include at least one member')

      let splits: { user_id: string; share_amount: number; share_type: string }[]

      if (splitMode === 'equal') {
        const ids = Array.from(includedMembers)
        const cents = Math.round(numericAmount * 100)
        const base = Math.floor(cents / ids.length)
        const remainder = cents - base * ids.length
        splits = ids.map((id, i) => ({
          user_id: id,
          share_amount: (base + (i < remainder ? 1 : 0)) / 100,
          share_type: 'equal',
        }))
      } else {
        if (Math.abs(exactTotal - numericAmount) > 0.01) {
          throw new Error(`Exact splits must total ${numericAmount.toFixed(2)}`)
        }
        splits = Array.from(includedMembers).map((uid) => ({
          user_id: uid,
          share_amount: parseFloat(exactSplits[uid] || '0'),
          share_type: 'exact',
        }))
      }

      const payload = {
        amount: numericAmount,
        description: description.trim(),
        category,
        currency,
        expense_date: expenseDate,
        paid_by: paidBy,
        splits,
      }

      if (isEdit && editId) {
        await update.mutateAsync({ id: editId, ...payload })
        push({ kind: 'success', message: 'Expense updated' })
      } else {
        await create.mutateAsync(payload)
        push({ kind: 'success', message: 'Expense added' })
      }
      onClose()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-expense-title"
      onClick={onClose}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between">
          <h2 id="add-expense-title" className="font-display text-xl font-bold tracking-tight">
            {isEdit ? 'Edit expense' : 'Add expense'}
          </h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="exp-desc" className="mb-1.5 block text-xs text-fg-muted">Description</label>
              <input
                id="exp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={100}
                autoComplete="off"
                placeholder="Pizza dinner"
                className="input-base"
              />
            </div>
            <div>
              <label htmlFor="exp-amount" className="mb-1.5 block text-xs text-fg-muted">Amount</label>
              <input
                id="exp-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.00"
                className="input-base tabular font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="exp-paidby" className="mb-1.5 block text-xs text-fg-muted">Paid by</label>
              <select
                id="exp-paidby"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="input-base"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                {members.map((m: any) => {
                  const wallet = m.profile?.wallet_address
                  const label = m.profile?.display_name || m.profile?.email || (wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'Member')
                  return (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user_id === currentUserId ? `You` : label}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label htmlFor="exp-date" className="mb-1.5 block text-xs text-fg-muted">Date</label>
              <input
                id="exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className="input-base"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label htmlFor="exp-cat" className="mb-1.5 block text-xs text-fg-muted">Category</label>
              <select
                id="exp-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-base capitalize"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-fg-muted">Split between</span>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-strong bg-bg-elev/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSplitMode('equal')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${splitMode === 'equal' ? 'bg-bg-card' : 'text-fg-muted hover:text-fg'}`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('exact')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${splitMode === 'exact' ? 'bg-bg-card' : 'text-fg-muted hover:text-fg'}`}
                >
                  Exact
                </button>
              </div>
            </div>
            <div className="space-y-1.5 rounded-xl border border-border-strong bg-bg-elev/40 p-2">
              {members.map((m: any) => {
                const wallet = m.profile?.wallet_address
                const label = m.profile?.display_name || m.profile?.email || (wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'Member')
                const checked = includedMembers.has(m.user_id)
                return (
                  <label
                    key={m.user_id}
                    htmlFor={`split-${m.user_id}`}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-bg-card/60"
                  >
                    <input
                      id={`split-${m.user_id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(m.user_id)}
                      className="h-4 w-4 shrink-0 accent-neon-violet"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                    {checked && splitMode === 'equal' && (
                      <span className="tabular font-mono text-xs text-fg-muted">{equalShare.toFixed(2)}</span>
                    )}
                    {checked && splitMode === 'exact' && (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={exactSplits[m.user_id] || ''}
                        onChange={(e) => setExactSplits((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                        placeholder="0.00"
                        aria-label={`Exact share for ${label}`}
                        className="w-24 rounded-lg border border-border-strong bg-bg-card px-2 py-1 text-right tabular font-mono text-xs"
                      />
                    )}
                  </label>
                )
              })}
            </div>
            {splitMode === 'exact' && numericAmount > 0 && (
              <div className={`mt-2 text-right text-xs tabular font-mono ${Math.abs(exactTotal - numericAmount) < 0.01 ? 'text-success' : 'text-danger'}`}>
                {exactTotal.toFixed(2)} / {numericAmount.toFixed(2)}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Saving…</>
              ) : isEdit ? 'Save changes' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}