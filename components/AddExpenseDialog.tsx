'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useCreateExpense, useUpdateExpense } from '@/lib/hooks'
import { displayName } from '@/lib/displayName'
import { useToast } from '@/components/Toaster'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
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
  onCreated,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  members: any[]
  currency: string
  prefill?: Prefill
  editId?: string
  onCreated?: (expense: { id: string; description: string; amount: number; currency: string; paid_by: string }) => void
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
  useBodyScrollLock(open)

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
        const created = await create.mutateAsync(payload)
        push({ kind: 'success', message: 'Expense added' })
        if (onCreated && created) {
          onCreated({
            id: created.id,
            description: payload.description,
            amount: payload.amount,
            currency: payload.currency,
            paid_by: payload.paid_by,
          })
        }
      }
      onClose()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-expense-title"
      onClick={onClose}
    >
      <div
        className="sheet-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
          <div className="sheet-header">
            <h2 id="add-expense-title" className="font-display text-lg font-bold tracking-tight sm:text-xl">
              {isEdit ? 'Edit expense' : 'Add expense'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="btn-icon -mr-2 text-fg-muted hover:text-fg"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 space-y-5 px-5 py-5">
            <div>
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
                className="input-base tabular font-mono text-lg sm:text-base"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                    const label = m.user_id === currentUserId ? 'You' : displayName(m.profile)
                    return (
                      <option key={m.user_id} value={m.user_id}>
                        {label}
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

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-fg-muted">Split between</span>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-strong bg-bg-elev/40 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSplitMode('equal')}
                    className={`min-h-[36px] rounded-md px-3 font-medium transition-colors ${splitMode === 'equal' ? 'bg-bg-card' : 'text-fg-muted'}`}
                  >
                    Equal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode('exact')}
                    className={`min-h-[36px] rounded-md px-3 font-medium transition-colors ${splitMode === 'exact' ? 'bg-bg-card' : 'text-fg-muted'}`}
                  >
                    Exact
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 rounded-xl border border-border-strong bg-bg-elev/40 p-2">
                {members.map((m: any) => {
                  const label = m.user_id === currentUserId ? 'You' : displayName(m.profile)
                  const checked = includedMembers.has(m.user_id)
                  return (
                    <div
                      key={m.user_id}
                      className="rounded-lg transition-colors hover:bg-bg-card/60"
                    >
                      <label
                        htmlFor={`split-${m.user_id}`}
                        className="flex min-h-[52px] cursor-pointer items-center gap-3 px-3 py-2"
                      >
                        <input
                          id={`split-${m.user_id}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(m.user_id)}
                          className="h-5 w-5 shrink-0 accent-neon-violet"
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
                            onClick={(e) => e.preventDefault()}
                            placeholder="0.00"
                            aria-label={`Exact share for ${label}`}
                            className="w-24 rounded-lg border border-border-strong bg-bg-card px-2 py-2 text-right tabular font-mono text-sm"
                            style={{ fontSize: '16px' }}
                          />
                        )}
                      </label>
                    </div>
                  )
                })}
              </div>
              {splitMode === 'exact' && numericAmount > 0 && (
                <div className={`mt-2 text-right text-xs tabular font-mono ${Math.abs(exactTotal - numericAmount) < 0.01 ? 'text-success' : 'text-danger'}`}>
                  {exactTotal.toFixed(2)} / {numericAmount.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <div className="sheet-footer">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary flex-1">
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : isEdit ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}