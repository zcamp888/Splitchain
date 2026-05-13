'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, Repeat } from 'lucide-react'
import { useCreateRecurring } from '@/lib/hooks/useRecurring'
import { useToast } from '@/components/Toaster'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const CATEGORIES = ['food', 'utilities', 'rent', 'subscription', 'transport', 'other']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function computeNextRun(frequency: 'weekly' | 'monthly' | 'yearly', anchor: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (frequency === 'weekly') {
    const targetDow = parseInt(anchor, 10)
    const currentDow = today.getDay()
    let diff = targetDow - currentDow
    if (diff <= 0) diff += 7
    const next = new Date(today)
    next.setDate(today.getDate() + diff)
    return next.toISOString().slice(0, 10)
  }

  if (frequency === 'monthly') {
    const targetDom = parseInt(anchor, 10)
    const next = new Date(today.getFullYear(), today.getMonth(), targetDom)
    if (next <= today) next.setMonth(next.getMonth() + 1)
    return next.toISOString().slice(0, 10)
  }

  // yearly: anchor format "MM-DD"
  const [mm, dd] = anchor.split('-').map((x) => parseInt(x, 10))
  const next = new Date(today.getFullYear(), mm - 1, dd)
  if (next <= today) next.setFullYear(next.getFullYear() + 1)
  return next.toISOString().slice(0, 10)
}

export function CreateRecurringDialog({
  open,
  onClose,
  groupId,
  members,
  currency,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  members: any[]
  currency: string
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('rent')
  const [paidBy, setPaidBy] = useState('')
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [yearlyMonth, setYearlyMonth] = useState('01')
  const [yearlyDay, setYearlyDay] = useState('01')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const create = useCreateRecurring(groupId)
  const { push } = useToast()

  useEffect(() => {
    if (!open) return
    setDescription('')
    setAmount('')
    setCategory('rent')
    setFrequency('monthly')
    setDayOfMonth('1')
    setDayOfWeek('1')
    setYearlyMonth('01')
    setYearlyDay('01')

    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id)
        setPaidBy(user.id)
      }
    })
  }, [open])

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
      if (!paidBy) throw new Error('Choose who pays')
      if (numericAmount <= 0) throw new Error('Amount must be greater than 0')
      if (members.length === 0) throw new Error('Group has no members')

      const anchor =
        frequency === 'weekly'
          ? dayOfWeek
          : frequency === 'monthly'
            ? dayOfMonth
            : `${yearlyMonth}-${yearlyDay}`

      const ids = members.map((m) => m.user_id)
      const cents = Math.round(numericAmount * 100)
      const base = Math.floor(cents / ids.length)
      const remainder = cents - base * ids.length
      const splits_template = ids.map((id: string, i: number) => ({
        user_id: id,
        share_amount: (base + (i < remainder ? 1 : 0)) / 100,
        share_type: 'equal',
      }))

      const next_run_at = computeNextRun(frequency, anchor)

      await create.mutateAsync({
        paid_by: paidBy,
        amount: numericAmount,
        currency,
        description: description.trim(),
        category,
        frequency,
        schedule_anchor: anchor,
        splits_template,
        next_run_at,
      })
      push({ kind: 'success', message: 'Recurring rule created' })
      onClose()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-rec-title"
      onClick={onClose}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="create-rec-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <Repeat className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
              New recurring expense
            </h2>
            <p className="mt-1 text-xs text-fg-muted">Auto-add this expense on a schedule.</p>
          </div>
          <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="rec-desc" className="mb-1.5 block text-xs text-fg-muted">Description</label>
              <input
                id="rec-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={100}
                autoFocus
                placeholder="Rent, Netflix, Gym…"
                className="input-base"
              />
            </div>
            <div>
              <label htmlFor="rec-amount" className="mb-1.5 block text-xs text-fg-muted">Amount</label>
              <input
                id="rec-amount"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.00"
                className="input-base tabular font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rec-paidby" className="mb-1.5 block text-xs text-fg-muted">Paid by</label>
              <select
                id="rec-paidby"
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
                      {m.user_id === currentUserId ? 'You' : label}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label htmlFor="rec-cat" className="mb-1.5 block text-xs text-fg-muted">Category</label>
              <select
                id="rec-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-base capitalize"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="rec-freq" className="mb-1.5 block text-xs text-fg-muted">Repeats</label>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-border-strong bg-bg-elev/40 p-1">
              {(['weekly', 'monthly', 'yearly'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${frequency === f ? 'bg-bg-card text-fg' : 'text-fg-muted hover:text-fg'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {frequency === 'weekly' && (
            <div>
              <label htmlFor="rec-dow" className="mb-1.5 block text-xs text-fg-muted">On</label>
              <select
                id="rec-dow"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="input-base"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={i} value={i}>{d}day</option>
                ))}
              </select>
            </div>
          )}

          {frequency === 'monthly' && (
            <div>
              <label htmlFor="rec-dom" className="mb-1.5 block text-xs text-fg-muted">Day of month</label>
              <select
                id="rec-dom"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="input-base"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-fg-dim">Max day 28 to avoid skipped months.</p>
            </div>
          )}

          {frequency === 'yearly' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rec-mm" className="mb-1.5 block text-xs text-fg-muted">Month</label>
                <select
                  id="rec-mm"
                  value={yearlyMonth}
                  onChange={(e) => setYearlyMonth(e.target.value)}
                  className="input-base"
                  style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0')
                    const name = new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' })
                    return <option key={m} value={m}>{name}</option>
                  })}
                </select>
              </div>
              <div>
                <label htmlFor="rec-dd" className="mb-1.5 block text-xs text-fg-muted">Day</label>
                <select
                  id="rec-dd"
                  value={yearlyDay}
                  onChange={(e) => setYearlyDay(e.target.value)}
                  className="input-base"
                  style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
                >
                  {Array.from({ length: 28 }, (_, i) => {
                    const d = String(i + 1).padStart(2, '0')
                    return <option key={d} value={d}>{i + 1}</option>
                  })}
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={create.isPending || !description.trim()} className="btn-primary">
              {create.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Creating…</>
              ) : 'Create rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}