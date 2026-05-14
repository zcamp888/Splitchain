'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import {
  Loader2, Trophy, Crown, Flame, Rocket, Gem, Sparkles, Zap, Compass,
  TrendingUp, Calendar, Users, Receipt, Lock, ArrowUpRight, BarChart3
} from 'lucide-react'
import { useLifetimeStats, type Badge } from '@/lib/hooks/useLifetimeStats'
import { formatCurrency } from '@/lib/balances'
import { chainName } from '@/lib/chains'

const ICON_MAP: Record<Badge['icon'], React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  crown: Crown,
  flame: Flame,
  rocket: Rocket,
  gem: Gem,
  trophy: Trophy,
  sparkles: Sparkles,
  zap: Zap,
  compass: Compass,
}

function formatTotals(totals: Record<string, number>): string | null {
  const entries = Object.entries(totals).filter(([, v]) => v > 0.01)
  if (entries.length === 0) return null
  return entries.map(([cur, val]) => formatCurrency(val, cur)).join(' · ')
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (days < 1) return 'today'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}

function BadgeCard({ badge }: { badge: Badge }) {
  const Icon = ICON_MAP[badge.icon]
  const pct = badge.progress ? (badge.progress.current / badge.progress.target) * 100 : 100

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 transition-all ${
        badge.earned
          ? 'border-neon-violet/40 bg-gradient-to-br from-neon-violet/10 via-neon-cyan/5 to-transparent hover:border-neon-violet/60'
          : 'border-border/60 bg-bg-elev/20 opacity-60 hover:opacity-100'
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          badge.earned
            ? 'bg-gradient-to-br from-neon-violet/30 to-neon-cyan/30 text-neon-cyan'
            : 'bg-bg-elev text-fg-dim'
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden={true} />
      </div>
      <h3 className="mt-3 font-display text-sm font-semibold">{badge.label}</h3>
      <p className="mt-0.5 text-xs text-fg-muted">{badge.description}</p>
      {badge.progress && !badge.earned && (
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-[10px] text-fg-dim">
            <span>Progress</span>
            <span className="tabular font-mono">
              {badge.progress.current}/{badge.progress.target}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-bg-elev">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      {badge.earned && (
        <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_10px_rgb(163,230,53)]" aria-hidden="true" />
      )}
    </div>
  )
}

export function StatsView() {
  const { data, isLoading } = useLifetimeStats()

  const monthlyChart = useMemo(() => {
    if (!data) return { bars: [], maxCount: 1, totalLabel: '' }
    const maxCount = Math.max(...data.monthly_activity.map((m) => m.count), 1)
    const totalSpend = data.monthly_activity.reduce((s, m) => s + m.total, 0)
    return {
      bars: data.monthly_activity,
      maxCount,
      totalLabel: formatCurrency(totalSpend, 'USD'),
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="glass flex items-center justify-center rounded-2xl p-12 text-fg-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!data || data.total_groups === 0) {
    return (
      <div className="glass rounded-3xl p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-violet/20 to-neon-cyan/20 text-neon-cyan">
          <Trophy className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="font-display text-xl font-semibold">No stats yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
          Join a group and start tracking expenses — your lifetime stats will show up here.
        </p>
        <Link href="/app" className="btn-primary mt-6 inline-flex">
          Go to dashboard
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    )
  }

  const earnedBadges = data.badges.filter((b) => b.earned).length
  const totalSpent = formatTotals(data.total_spent_across_groups)
  const myShare = formatTotals(data.my_share_across_groups)
  const memberSinceLabel = data.oldest_member_since ? timeAgo(data.oldest_member_since) : ''

  return (
    <div className="space-y-8">
      {/* Hero card */}
      <section className="glass-strong relative overflow-hidden rounded-3xl p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-neon-violet/15 blur-[80px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-neon-cyan/10 blur-[100px]"
        />

        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-muted">
            <Trophy className="h-3.5 w-3.5 text-neon-lime" aria-hidden="true" />
            Your lifetime stats
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            <span className="bg-gradient-to-br from-fg via-neon-cyan to-neon-violet bg-clip-text text-transparent">
              {data.total_expenses}
            </span>{' '}
            expenses tracked
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted text-pretty">
            Member since {memberSinceLabel} · {data.total_groups} group{data.total_groups === 1 ? '' : 's'} ·{' '}
            {data.total_vaults} vault{data.total_vaults === 1 ? '' : 's'} · {earnedBadges}/{data.badges.length} badges earned
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/60 bg-bg-elev/30 p-4 backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim">Total flowed</div>
              <div className="mt-1 tabular font-mono text-xl font-bold text-balance">
                {totalSpent || '—'}
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-bg-elev/30 p-4 backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim">Your share</div>
              <div className="mt-1 tabular font-mono text-xl font-bold text-neon-lime text-balance">
                {myShare || '—'}
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-bg-elev/30 p-4 backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim">You paid</div>
              <div className="mt-1 tabular font-mono text-xl font-bold">
                {data.i_paid_count}<span className="text-sm font-medium text-fg-muted"> times</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-bg-elev/30 p-4 backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim">Current streak</div>
              <div className="mt-1 tabular font-mono text-xl font-bold text-neon-violet">
                {data.current_streak_days}<span className="text-sm font-medium text-fg-muted"> day{data.current_streak_days === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* On-chain stats card */}
      {data.total_vaults > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <Lock className="h-4 w-4 text-neon-violet" aria-hidden="true" />
            On-chain
            <span className="ml-auto text-xs font-normal text-fg-dim">USDC across all vaults</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim">Total pooled</div>
              <div className="mt-1 tabular font-mono text-2xl font-bold">
                {formatCurrency(data.total_pooled_usdc, 'USD')}
              </div>
              <div className="mt-1 text-xs text-fg-muted">
                across {data.total_vaults} vault{data.total_vaults === 1 ? '' : 's'}
              </div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim">You deposited</div>
              <div className="mt-1 tabular font-mono text-2xl font-bold text-neon-cyan">
                {formatCurrency(data.total_deposited_usdc, 'USD')}
              </div>
              <div className="mt-1 text-xs text-fg-muted">your contributions</div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim">You claimed</div>
              <div className="mt-1 tabular font-mono text-2xl font-bold text-neon-lime">
                {formatCurrency(data.total_claimed_usdc, 'USD')}
              </div>
              <div className="mt-1 text-xs text-fg-muted">reimbursements</div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim">Refunded</div>
              <div className="mt-1 tabular font-mono text-2xl font-bold text-neon-violet">
                {formatCurrency(data.total_refunded_usdc, 'USD')}
              </div>
              <div className="mt-1 text-xs text-fg-muted">unspent pool returned</div>
            </div>
          </div>
        </section>
      )}

      {/* Records */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <Crown className="h-4 w-4 text-neon-lime" aria-hidden="true" />
          Records
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {data.longest_group && (
            <Link
              href={`/app/groups/${data.longest_group.group_id}`}
              className="glass group rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-neon-violet/40"
            >
              <div className="flex items-start justify-between">
                <Calendar className="h-4 w-4 text-neon-violet" aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-wider text-fg-dim">Longest-running</span>
              </div>
              <div className="mt-3 text-3xl" aria-hidden="true">{data.longest_group.emoji}</div>
              <h3 className="mt-2 font-display font-semibold line-clamp-1">{data.longest_group.name}</h3>
              <div className="mt-1 tabular font-mono text-sm text-fg-muted">
                {data.longest_group.days_active} days active
              </div>
            </Link>
          )}
          {data.biggest_group && (
            <Link
              href={`/app/groups/${data.biggest_group.group_id}`}
              className="glass group rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-neon-cyan/40"
            >
              <div className="flex items-start justify-between">
                <Users className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-wider text-fg-dim">Biggest crew</span>
              </div>
              <div className="mt-3 text-3xl" aria-hidden="true">{data.biggest_group.emoji}</div>
              <h3 className="mt-2 font-display font-semibold line-clamp-1">{data.biggest_group.name}</h3>
              <div className="mt-1 tabular font-mono text-sm text-fg-muted">
                {data.biggest_group.member_count} members
              </div>
            </Link>
          )}
          {data.most_active_group && (
            <Link
              href={`/app/groups/${data.most_active_group.group_id}`}
              className="glass group rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-neon-lime/40"
            >
              <div className="flex items-start justify-between">
                <Receipt className="h-4 w-4 text-neon-lime" aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-wider text-fg-dim">Most active</span>
              </div>
              <div className="mt-3 text-3xl" aria-hidden="true">{data.most_active_group.emoji}</div>
              <h3 className="mt-2 font-display font-semibold line-clamp-1">{data.most_active_group.name}</h3>
              <div className="mt-1 tabular font-mono text-sm text-fg-muted">
                {data.most_active_group.expense_count} expenses
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* Badges */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
          Badges
          <span className="ml-auto text-xs font-normal text-fg-dim">
            {earnedBadges} of {data.badges.length} earned
          </span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.badges.map((b) => (
            <BadgeCard key={b.id} badge={b} />
          ))}
        </div>
      </section>

      {/* Monthly activity */}
      {data.monthly_activity.some((m) => m.count > 0) && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <BarChart3 className="h-4 w-4 text-neon-violet" aria-hidden="true" />
            Activity over time
            <span className="ml-auto text-xs font-normal text-fg-dim">Last 12 months</span>
          </h2>
          <div className="glass rounded-2xl p-6">
            <div className="flex h-32 items-end gap-2">
              {monthlyChart.bars.map((m, i) => {
                const heightPct = (m.count / monthlyChart.maxCount) * 100
                const date = new Date(`${m.month}-01`)
                const isCurrent = i === monthlyChart.bars.length - 1
                return (
                  <div key={m.month} className="group/bar relative flex flex-1 flex-col items-center justify-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        isCurrent
                          ? 'bg-gradient-to-t from-neon-violet to-neon-cyan'
                          : m.count > 0
                            ? 'bg-bg-elev hover:bg-neon-cyan/30'
                            : 'bg-bg-elev/30'
                      }`}
                      style={{ height: `${Math.max(heightPct, 3)}%` }}
                      role="img"
                      aria-label={`${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${m.count} expenses, ${formatCurrency(m.total, 'USD')}`}
                    />
                    <span className="mt-2 text-[10px] text-fg-dim">
                      {date.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-strong bg-bg-card px-2 py-1 text-[10px] tabular font-mono opacity-0 transition-opacity group-hover/bar:opacity-100">
                      {m.count} · {formatCurrency(m.total, 'USD')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Vault hall of fame */}
      {data.vaults.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <Lock className="h-4 w-4 text-neon-violet" aria-hidden="true" />
            Vaults
          </h2>
          <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl">
            {data.vaults.slice(0, 6).map((v) => (
              <li key={v.vault_id} className="flex items-center gap-4 px-5 py-4">
                <span className="text-2xl shrink-0" aria-hidden="true">{v.group_emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{v.name}</span>
                    {v.is_biggest_spender && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neon-lime/15 px-1.5 py-0.5 text-[10px] font-medium text-neon-lime">
                        <Crown className="h-2.5 w-2.5" aria-hidden="true" />
                        big spender
                      </span>
                    )}
                    {v.status === 'closed' && (
                      <span className="shrink-0 rounded-full border border-fg-dim/30 bg-bg-elev px-1.5 py-0.5 text-[10px] text-fg-muted">closed</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-dim">
                    <span className="truncate">{v.group_name}</span>
                    <span>·</span>
                    <span>{chainName(v.chain_id)}</span>
                    {v.duration_days && (
                      <>
                        <span>·</span>
                        <span>{v.duration_days}d</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular font-mono text-sm font-semibold">
                    {formatCurrency(v.total_pooled, 'USD')}
                  </div>
                  <div className="text-[10px] text-fg-dim">pool</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* All groups */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <Users className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
          Your groups
          <span className="ml-auto text-xs font-normal text-fg-dim">{data.total_groups} total</span>
        </h2>
        <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl">
          {data.groups.map((g) => (
            <li key={g.group_id}>
              <Link
                href={`/app/groups/${g.group_id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-elev/40"
              >
                <span className="text-2xl shrink-0" aria-hidden="true">{g.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{g.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-dim">
                    <span>{g.member_count} members</span>
                    <span>·</span>
                    <span>{g.expense_count} expenses</span>
                    <span>·</span>
                    <span>{g.days_active}d active</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular font-mono text-sm font-semibold">
                    {formatCurrency(g.total_spent, g.currency)}
                  </div>
                  <div className="text-[10px] text-fg-dim">
                    your share {formatCurrency(g.my_share, g.currency)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}