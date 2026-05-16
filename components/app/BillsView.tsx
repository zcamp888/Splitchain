'use client'

import { useState } from 'react'
import { Plus, Loader2, Calendar, Trash2, Check, AlertCircle } from 'lucide-react'
import { useBills, useToggleBillPaid, useDeleteBill } from '@/lib/hooks/useBills'
import { CreateBillDialog } from '@/components/app/CreateBillDialog'
import { useToast } from '@/components/Toaster'
import { formatCurrency } from '@/lib/balances'

export function BillsView() {
  const { data: bills, isLoading } = useBills()
  const toggle = useToggleBillPaid()
  const del = useDeleteBill()
  const { push } = useToast()
  const [showCreate, setShowCreate] = useState(false)

  const handleToggle = async (id: string, paid: boolean) => {
    try {
      await toggle.mutateAsync({ id, paid: !paid })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bill?')) return
    try {
      await del.mutateAsync(id)
      push({ kind: 'success', message: 'Bill removed' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = (bills || []).filter((b: any) => !b.paid)
  const paid = (bills || []).filter((b: any) => b.paid)
  const totalUpcoming = upcoming.reduce((s: number, b: any) => s + Number(b.amount), 0)

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-3 sm:mb-8">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">My bills</h1>
          <p className="mt-1 text-sm text-fg-muted">Track personal recurring expenses.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-3 py-2 text-sm sm:px-5">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">New bill</span>
        </button>
      </header>

      {!isLoading && bills && bills.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="glass rounded-2xl p-3 sm:p-5">
            <div className="text-[10px] uppercase tracking-wider text-fg-dim sm:text-xs">Upcoming</div>
            <div className="mt-1 tabular font-mono text-xl font-bold sm:text-2xl">{upcoming.length}</div>
          </div>
          <div className="glass rounded-2xl p-3 sm:p-5">
            <div className="text-[10px] uppercase tracking-wider text-fg-dim sm:text-xs">Due</div>
            <div className="mt-1 tabular font-mono text-base font-bold text-neon-lime text-balance sm:text-2xl">
              {formatCurrency(totalUpcoming, 'USD')}
            </div>
          </div>
          <div className="glass rounded-2xl p-3 sm:p-5">
            <div className="text-[10px] uppercase tracking-wider text-fg-dim sm:text-xs">Paid</div>
            <div className="mt-1 tabular font-mono text-xl font-bold text-fg-muted sm:text-2xl">{paid.length}</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="glass flex items-center justify-center rounded-2xl p-12 text-fg-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : !bills || bills.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-neon-cyan/10 text-neon-cyan">
            <Calendar className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-xl font-semibold">No bills yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
            Track rent, utilities, subscriptions — whatever you don&rsquo;t want to forget.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-6">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add bill
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-wider text-fg-muted">Upcoming</h2>
              <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl">
                {upcoming.map((b: any) => {
                  const overdue = b.due_date < today
                  return (
                    <li key={b.id} className="group flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
                      <button
                        onClick={() => handleToggle(b.id, b.paid)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-border-strong transition-colors active:scale-90 hover:border-neon-lime hover:bg-neon-lime/10"
                        aria-label={`Mark ${b.name} as paid`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium line-clamp-1">{b.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
                          <span className={overdue ? 'flex items-center gap-1 text-danger' : ''}>
                            {overdue && <AlertCircle className="h-3 w-3" aria-hidden="true" />}
                            {new Date(b.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {b.recurrence !== 'once' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize">{b.recurrence}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tabular font-mono text-sm font-semibold">
                          {formatCurrency(Number(b.amount), b.currency)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="btn-icon shrink-0 text-fg-dim hover:bg-danger/10 hover:text-danger"
                        aria-label={`Delete ${b.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {paid.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-wider text-fg-muted">Paid</h2>
              <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl opacity-70">
                {paid.map((b: any) => (
                  <li key={b.id} className="group flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
                    <button
                      onClick={() => handleToggle(b.id, b.paid)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-bg active:scale-90"
                      aria-label={`Mark ${b.name} as unpaid`}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium line-through line-clamp-1">{b.name}</div>
                    </div>
                    <div className="shrink-0 tabular font-mono text-sm text-fg-muted line-through">
                      {formatCurrency(Number(b.amount), b.currency)}
                    </div>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="btn-icon shrink-0 text-fg-dim hover:bg-danger/10 hover:text-danger"
                      aria-label={`Delete ${b.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <CreateBillDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}