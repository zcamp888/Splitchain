'use client'

import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useCreateBill } from '@/lib/hooks/useBills'
import { useToast } from '@/components/Toaster'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'

const CATEGORIES = ['rent', 'utilities', 'subscription', 'insurance', 'loan', 'other']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']

export function CreateBillDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [recurrence, setRecurrence] = useState<'once' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [category, setCategory] = useState('utilities')
  const create = useCreateBill()
  const { push } = useToast()
  useBodyScrollLock(open)

  useEffect(() => {
    if (open) {
      setName('')
      setAmount('')
      setCurrency('USD')
      setDueDate(new Date().toISOString().slice(0, 10))
      setRecurrence('monthly')
      setCategory('utilities')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const n = parseFloat(amount)
      if (isNaN(n) || n <= 0) throw new Error('Amount must be greater than 0')
      await create.mutateAsync({
        name: name.trim(),
        amount: n,
        currency,
        due_date: dueDate,
        recurrence,
        category,
      })
      push({ kind: 'success', message: 'Bill added' })
      onClose()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-bill-title"
      onClick={onClose}
    >
      <div
        className="sheet-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="flex items-start justify-between gap-3 px-6 pt-2">
          <h2 id="create-bill-title" className="font-display text-xl font-bold tracking-tight">New bill</h2>
          <button onClick={onClose} className="btn-icon -mr-2 text-fg-muted hover:text-fg" aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="bill-name" className="mb-1.5 block text-xs text-fg-muted">Name</label>
            <input
              id="bill-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              autoComplete="off"
              autoFocus
              placeholder="Electricity"
              className="input-base"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="bill-amount" className="mb-1.5 block text-xs text-fg-muted">Amount</label>
              <input
                id="bill-amount"
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
            <div>
              <label htmlFor="bill-currency" className="mb-1.5 block text-xs text-fg-muted">Currency</label>
              <select
                id="bill-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input-base"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bill-due" className="mb-1.5 block text-xs text-fg-muted">Due date</label>
              <input
                id="bill-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="input-base"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label htmlFor="bill-rec" className="mb-1.5 block text-xs text-fg-muted">Repeats</label>
              <select
                id="bill-rec"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="input-base capitalize"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                <option value="once">Once</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="bill-cat" className="mb-1.5 block text-xs text-fg-muted">Category</label>
            <select
              id="bill-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-base capitalize"
              style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
            >
              {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={create.isPending || !name.trim()} className="btn-primary flex-1">
              {create.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : 'Add bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}