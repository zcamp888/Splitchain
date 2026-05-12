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
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">My bills</h1>
          <p className="mt-1 text-sm text-fg-muted">Track personal recurring expenses.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New bill
        </button>
      </header>

      {!isLoading && bills && bills.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-fg-dim">Upcoming</div>
            <div className="mt-1 tabular font-mono text-2xl font-bold">{upcoming.length}</div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-fg-dim">Total due</div>
            <div className="mt-1 tabular font-mono text-2xl font-bold text-neon-lime">
              {formatCurrency(totalUpcoming, 'USD')}
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-fg-dim">Paid</div>
            <div className="mt-1 tabular font-mono text-2xl font-bold text-fg-muted">{paid.length}</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="glass flex items-center justify-center rounded-2xl p-12 text-fg-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : !bills || bills.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
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
                    <li key={b.id} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-elev/30">
                      <button
                        onClick={() => handleToggle(b.id, b.paid)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border-strong transition-colors hover:border-neon-lime hover:bg-neon-lime/10"
                        aria-label={`Mark ${b.name} as paid`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium line-clamp-1">{b.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
                          <span className={overdue ? 'flex items-center gap-1 text-danger' : ''}>
                            {overdue && <AlertCircle className="h-3 w-3" aria-hidden="true" />}
                            Due {new Date(b.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {b.recurrence !== 'once' && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{b.recurrence}</span>
                            </>
                          )}
                          {b.category && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{b.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 tabular font-mono font-semibold">
                        {formatCurrency(Number(b.amount), b.currency)}
                      </div>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="shrink-0 rounded-lg p-2 text-fg-dim opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
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
                  <li key={b.id} className="group flex items-center gap-4 px-5 py-4">
                    <button
                      onClick={() => handleToggle(b.id, b.paid)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-bg"
                      aria-label={`Mark ${b.name} as unpaid`}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium line-through line-clamp-1">{b.name}</div>
                      <div className="mt-0.5 text-xs text-fg-dim">
                        {new Date(b.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="shrink-0 tabular font-mono text-fg-muted line-through">
                      {formatCurrency(Number(b.amount), b.currency)}
                    </div>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="shrink-0 rounded-lg p-2 text-fg-dim opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
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