'use client'

import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useInsights } from '@/lib/hooks/useInsights'
import { formatCurrency } from '@/lib/balances'

const CATEGORY_COLORS: Record<string, string> = {
  food: 'rgb(var(--neon-lime))',
  travel: 'rgb(var(--neon-cyan))',
  lodging: 'rgb(var(--neon-violet))',
  transport: '#f59e0b',
  entertainment: '#ec4899',
  utilities: '#06b6d4',
  other: 'rgb(var(--fg-muted))',
}

export function SpendingInsights() {
  const { data, isLoading } = useInsights()

  if (isLoading) {
    return (
      <div className="glass flex items-center justify-center rounded-2xl p-10 text-fg-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!data || (data.totalThisMonth === 0 && data.monthlyTrend.every((m) => m.total === 0))) {
    return null
  }

  const delta = data.totalThisMonth - data.totalLastMonth
  const deltaPct = data.totalLastMonth > 0 ? Math.round((delta / data.totalLastMonth) * 100) : 0
  const TrendIcon = delta > 0.01 ? TrendingUp : delta < -0.01 ? TrendingDown : Minus
  const trendColor = delta > 0.01 ? 'text-danger' : delta < -0.01 ? 'text-success' : 'text-fg-muted'

  const maxMonth = Math.max(...data.monthlyTrend.map((m) => m.total), 1)
  const totalCats = data.topCategories.reduce((s, c) => s + c.total, 0)

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        <TrendingUp className="h-4 w-4 text-neon-lime" aria-hidden="true" />
        Your spending
      </h2>

      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-fg-dim">This month</div>
            <div className="mt-1 tabular font-mono text-3xl font-bold text-balance">
              {formatCurrency(data.totalThisMonth, data.currency)}
            </div>
          </div>
          {data.totalLastMonth > 0 && (
            <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
              <TrendIcon className="h-4 w-4" aria-hidden="true" />
              <span className="tabular font-mono">
                {delta > 0 ? '+' : ''}{formatCurrency(Math.abs(delta), data.currency)}
              </span>
              <span className="text-xs text-fg-dim">
                ({deltaPct > 0 ? '+' : ''}{deltaPct}% vs last)
              </span>
            </div>
          )}
        </div>

        {/* Sparkline-ish monthly bar chart */}
        <div className="mt-6">
          <div className="flex h-24 items-end gap-1.5">
            {data.monthlyTrend.map((m, i) => {
              const heightPct = (m.total / maxMonth) * 100
              const isCurrent = i === data.monthlyTrend.length - 1
              const date = new Date(`${m.month}-01`)
              return (
                <div key={m.month} className="group relative flex flex-1 flex-col items-center justify-end">
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      isCurrent ? 'bg-gradient-to-t from-neon-violet to-neon-cyan' : 'bg-bg-elev'
                    }`}
                    style={{ height: `${Math.max(heightPct, 3)}%` }}
                    role="img"
                    aria-label={`${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${formatCurrency(m.total, data.currency)}`}
                  />
                  <span className="mt-1.5 text-[10px] text-fg-dim">
                    {date.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-strong bg-bg-card px-2 py-1 text-[10px] tabular font-mono opacity-0 transition-opacity group-hover:opacity-100">
                    {formatCurrency(m.total, data.currency)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {data.topCategories.length > 0 && (
          <div className="mt-6 border-t border-border/60 pt-5">
            <div className="mb-3 text-xs uppercase tracking-wider text-fg-dim">Top categories this month</div>
            <ul className="space-y-2">
              {data.topCategories.map((c) => {
                const pct = totalCats > 0 ? (c.total / totalCats) * 100 : 0
                const color = CATEGORY_COLORS[c.category] || CATEGORY_COLORS.other
                return (
                  <li key={c.category} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 capitalize">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        {c.category}
                        <span className="text-xs text-fg-dim">({c.count})</span>
                      </span>
                      <span className="tabular font-mono">
                        {formatCurrency(c.total, data.currency)}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-bg-elev">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}