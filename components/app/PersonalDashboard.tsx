'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, Users, Loader2, TrendingUp, TrendingDown, AlertCircle, Calendar, Receipt as ReceiptIcon, ArrowUpRight, Sparkles } from 'lucide-react'
import { useGroups } from '@/lib/hooks'
import { useDashboard } from '@/lib/hooks/useDashboard'
import { CreateGroupDialog } from '@/components/CreateGroupDialog'
import { formatCurrency } from '@/lib/balances'

function formatTotals(totals: Record<string, number>) {
  const entries = Object.entries(totals).filter(([, v]) => v > 0.01)
  if (entries.length === 0) return null
  return entries.map(([cur, val]) => formatCurrency(val, cur)).join(' · ')
}

export function PersonalDashboard() {
  const [showCreate, setShowCreate] = useState(false)
  const { data: groups, isLoading: groupsLoading } = useGroups()
  const { data: dash, isLoading: dashLoading } = useDashboard()

  const isLoading = groupsLoading || dashLoading
  const hasGroups = groups && groups.length > 0
  const owedToYou = dash ? formatTotals(dash.totalOwedToYou) : null
  const youOwe = dash ? formatTotals(dash.totalYouOwe) : null
  const netPositive = dash && Object.values(dash.totalOwedToYou).reduce((s, v) => s + v, 0) >=
    Object.values(dash.totalYouOwe).reduce((s, v) => s + v, 0)

  return (
    <div>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-fg-muted">Where you stand across all your groups.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New group
        </button>
      </header>

      {isLoading ? (
        <div className="glass flex items-center justify-center rounded-2xl p-12 text-fg-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="ml-2 text-sm">Loading…</span>
        </div>
      ) : !hasGroups && (!dash?.overdueBills.length && !dash?.upcomingBills.length) ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-violet/20 to-neon-cyan/20 text-neon-cyan">
            <Sparkles className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="font-display text-xl font-semibold">Welcome to SplitChain</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
            Create your first group to start splitting expenses with friends.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-6">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create group
          </button>
        </div>
      ) : (
        <>
          {/* Hero: net position */}
          {dash && (owedToYou || youOwe) && (
            <section className="mb-8 grid gap-4 sm:grid-cols-2">
              <div className={`glass-strong rounded-3xl p-6 transition-all ${netPositive ? 'border-success/30' : 'border-border/60'}`}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
                  <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  You&rsquo;re owed
                </div>
                <div className="mt-2 tabular font-mono text-3xl font-bold text-success sm:text-4xl text-balance">
                  {owedToYou || formatCurrency(0, 'USD')}
                </div>
                <div className="mt-1 text-xs text-fg-dim">
                  Across {dash.groupBalances.filter((g) => g.net > 0.01).length} group{dash.groupBalances.filter((g) => g.net > 0.01).length === 1 ? '' : 's'}
                </div>
              </div>
              <div className={`glass-strong rounded-3xl p-6 transition-all ${!netPositive && youOwe ? 'border-danger/30' : 'border-border/60'}`}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
                  <TrendingDown className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                  You owe
                </div>
                <div className="mt-2 tabular font-mono text-3xl font-bold text-danger sm:text-4xl text-balance">
                  {youOwe || formatCurrency(0, 'USD')}
                </div>
                <div className="mt-1 text-xs text-fg-dim">
                  Across {dash.groupBalances.filter((g) => g.net < -0.01).length} group{dash.groupBalances.filter((g) => g.net < -0.01).length === 1 ? '' : 's'}
                </div>
              </div>
            </section>
          )}

          {/* Overdue bills alert */}
          {dash && dash.overdueBills.length > 0 && (
            <section className="mb-6 rounded-2xl border border-danger/30 bg-danger/5 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-semibold text-danger">
                    {dash.overdueBills.length} overdue bill{dash.overdueBills.length === 1 ? '' : 's'}
                  </h2>
                  <ul className="mt-2 space-y-1">
                    {dash.overdueBills.slice(0, 3).map((b: any) => (
                      <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{b.name}</span>
                        <span className="shrink-0 tabular font-mono text-fg-muted">
                          {formatCurrency(Number(b.amount), b.currency)} · due {new Date(b.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/app/bills" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline">
                    Review all bills <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Groups column (2/3) */}
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Users className="h-4 w-4 text-neon-violet" aria-hidden="true" />
                  Your groups
                </h2>
                {hasGroups && (
                  <span className="text-xs text-fg-dim">{groups!.length} total</span>
                )}
              </div>

              {!hasGroups ? (
                <div className="glass rounded-2xl p-8 text-center text-sm text-fg-muted">
                  No groups yet. Create one to start splitting.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {groups!.map((g: any) => {
                    const balance = dash?.groupBalances.find((b) => b.group_id === g.id)
                    const net = balance?.net || 0
                    const positive = net > 0.01
                    const negative = net < -0.01
                    return (
                      <Link
                        key={g.id}
                        href={`/app/groups/${g.id}`}
                        className="glass group rounded-2xl p-4 transition-all duration-300 hover:border-neon-violet/40 hover:-translate-y-0.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-3xl" aria-hidden="true">{g.cover_emoji}</div>
                          {positive && (
                            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">+{formatCurrency(net, g.currency)}</span>
                          )}
                          {negative && (
                            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">{formatCurrency(net, g.currency)}</span>
                          )}
                          {!positive && !negative && (
                            <span className="rounded-full border border-border/60 bg-bg-elev/60 px-2 py-0.5 text-[10px] text-fg-dim">settled</span>
                          )}
                        </div>
                        <h3 className="mt-3 font-display font-semibold text-balance line-clamp-1">{g.name}</h3>
                        <div className="mt-1 flex items-center justify-between text-xs text-fg-dim">
                          <span>{balance?.member_count || 0} member{(balance?.member_count || 0) === 1 ? '' : 's'}</span>
                          <span className="text-neon-cyan opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Side column (1/3): activity + bills */}
            <div className="space-y-6">
              {dash && dash.recentActivity.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                    <ReceiptIcon className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
                    Recent activity
                  </h2>
                  <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl">
                    {dash.recentActivity.map((a: any) => (
                      <li key={a.id}>
                        <Link
                          href={`/app/groups/${a.group_id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-elev/30"
                        >
                          <span className="text-xl shrink-0" aria-hidden="true">{a.group_emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{a.description}</div>
                            <div className="text-xs text-fg-dim">
                              {a.paid_by_me ? 'You paid' : `Your share`} ·{' '}
                              {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <div className={`shrink-0 tabular font-mono text-sm ${a.paid_by_me ? 'text-success' : 'text-fg-muted'}`}>
                            {a.paid_by_me ? formatCurrency(a.amount, a.currency) : formatCurrency(a.my_share, a.currency)}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {dash && dash.upcomingBills.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                    <Calendar className="h-4 w-4 text-neon-lime" aria-hidden="true" />
                    Upcoming bills
                  </h2>
                  <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl">
                    {dash.upcomingBills.map((b: any) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{b.name}</div>
                          <div className="text-xs text-fg-dim">
                            Due {new Date(b.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <div className="shrink-0 tabular font-mono text-sm">
                          {formatCurrency(Number(b.amount), b.currency)}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Link href="/app/bills" className="mt-2 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
                    View all bills <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </section>
              )}
            </div>
          </div>
        </>
      )}

      <CreateGroupDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}