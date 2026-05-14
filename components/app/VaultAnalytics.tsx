'use client'

import { useState } from 'react'
import { BarChart3, ChevronDown, ChevronUp, Loader2, TrendingUp, Users, Zap, Trophy, Sparkles, Calendar, Target } from 'lucide-react'
import { useVaultAnalytics, type MemberContribution } from '@/lib/hooks/useVaultAnalytics'
import { chainName } from '@/lib/chains'

function formatUSDC(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function ContributionRow({ c, maxDeposit, maxClaim }: { c: MemberContribution; maxDeposit: number; maxClaim: number }) {
  const depositPct = maxDeposit > 0 ? (c.deposited / maxDeposit) * 100 : 0
  const claimPct = maxClaim > 0 ? (c.claimed / maxClaim) * 100 : 0
  // Net positive (contributed more than took) → green; net negative (took more) → orange
  const netPositive = c.net > 0.01
  const netNegative = c.net < -0.01

  return (
    <li className={`rounded-2xl border p-4 transition-colors ${c.is_me ? 'border-neon-violet/40 bg-neon-violet/5' : 'border-border/60 bg-bg-elev/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{c.display_name}</span>
            {c.is_me && (
              <span className="rounded-full bg-neon-violet/15 px-1.5 py-0.5 text-[10px] font-medium text-neon-violet">
                you
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-fg-dim">
            {c.wallet_address.slice(0, 6)}…{c.wallet_address.slice(-4)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wider text-fg-dim">Net</div>
          <div className={`tabular font-mono text-sm font-semibold ${netPositive ? 'text-success' : netNegative ? 'text-neon-cyan' : 'text-fg-muted'}`}>
            {netPositive ? '+' : ''}{formatUSDC(c.net)}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="mb-0.5 flex items-baseline justify-between text-xs">
            <span className="text-fg-muted">Deposited</span>
            <span className="tabular font-mono">
              <span className="font-semibold">{formatUSDC(c.deposited)}</span>
              <span className="ml-1 text-[10px] text-fg-dim">({c.share_of_pool_pct.toFixed(0)}%)</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-elev">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan transition-all"
              style={{ width: `${depositPct}%` }}
              role="img"
              aria-label={`Deposited ${formatUSDC(c.deposited)} USDC`}
            />
          </div>
        </div>

        {c.claimed > 0 && (
          <div>
            <div className="mb-0.5 flex items-baseline justify-between text-xs">
              <span className="text-fg-muted">Claimed</span>
              <span className="tabular font-mono">
                <span className="font-semibold">{formatUSDC(c.claimed)}</span>
                <span className="ml-1 text-[10px] text-fg-dim">({c.share_of_claims_pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-elev">
              <div
                className="h-full rounded-full bg-gradient-to-r from-neon-lime to-success transition-all"
                style={{ width: `${claimPct}%` }}
                role="img"
                aria-label={`Claimed ${formatUSDC(c.claimed)} USDC`}
              />
            </div>
          </div>
        )}

        {c.refunded > 0 && (
          <div className="flex items-baseline justify-between text-xs">
            <span className="flex items-center gap-1 text-fg-muted">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Refunded
            </span>
            <span className="tabular font-mono font-semibold text-neon-cyan">
              {formatUSDC(c.refunded)}
            </span>
          </div>
        )}
      </div>
    </li>
  )
}

export function VaultAnalytics({ vaultId }: { vaultId: string }) {
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading } = useVaultAnalytics(expanded ? vaultId : undefined)

  return (
    <div className="mt-4 border-t border-border/40 pt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-xs text-fg-muted transition-colors hover:bg-bg-elev/30 hover:text-fg"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          Contribution analytics
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="mt-4">
          {isLoading || !data ? (
            <div className="flex items-center justify-center py-8 text-fg-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Headline stats grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-bg-elev/30 p-3">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-dim">
                    <Target className="h-3 w-3" aria-hidden="true" />
                    Efficiency
                  </div>
                  <div className="mt-1 tabular font-mono text-base font-bold">
                    {data.efficiency.toFixed(0)}<span className="text-xs font-medium text-fg-muted">%</span>
                  </div>
                  <div className="text-[10px] text-fg-dim">spent / pooled</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-bg-elev/30 p-3">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-dim">
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    Claims
                  </div>
                  <div className="mt-1 tabular font-mono text-base font-bold">
                    {data.claim_count}
                  </div>
                  <div className="text-[10px] text-fg-dim">
                    avg {formatUSDC(data.avg_claim_size)}
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-bg-elev/30 p-3">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-dim">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    Members
                  </div>
                  <div className="mt-1 tabular font-mono text-base font-bold">
                    {data.member_count}
                  </div>
                  <div className="text-[10px] text-fg-dim">{data.deposit_count} deposits</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-bg-elev/30 p-3">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-dim">
                    <Calendar className="h-3 w-3" aria-hidden="true" />
                    {data.status === 'closed' ? 'Duration' : 'Running'}
                  </div>
                  <div className="mt-1 tabular font-mono text-base font-bold">
                    {data.duration_days !== null ? (
                      <>{data.duration_days}<span className="text-xs font-medium text-fg-muted">d</span></>
                    ) : (
                      <>—</>
                    )}
                  </div>
                  <div className="text-[10px] text-fg-dim">{chainName(data.chain_id)}</div>
                </div>
              </div>

              {/* Trophy: biggest spender */}
              {data.biggestSpender && data.biggestSpender.claimed > 0 && (
                <div className="rounded-2xl border border-neon-lime/30 bg-gradient-to-br from-neon-lime/10 to-neon-cyan/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-lime/20 text-neon-lime">
                      <Trophy className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-fg-dim">
                        Biggest payer
                      </div>
                      <div className="truncate font-display font-semibold">
                        {data.biggestSpender.display_name}
                      </div>
                      <div className="text-xs text-fg-muted">
                        Claimed {formatUSDC(data.biggestSpender.claimed)} USDC across the trip
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-member contributions */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-fg-muted">
                  <TrendingUp className="h-3 w-3" aria-hidden="true" />
                  Per-member breakdown
                </h4>
                <ul className="space-y-2">
                  {data.contributions.map((c) => (
                    <ContributionRow
                      key={c.wallet_address}
                      c={c}
                      maxDeposit={Math.max(...data.contributions.map((x) => x.deposited), 1)}
                      maxClaim={Math.max(...data.contributions.map((x) => x.claimed), 1)}
                    />
                  ))}
                </ul>
              </div>

              {data.status === 'closed' && data.total_refunded > 0 && (
                <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs text-fg-muted">
                  <span className="font-semibold text-neon-cyan">{formatUSDC(data.total_refunded)} USDC</span> refunded proportionally to {data.contributions.filter((c) => c.refunded > 0).length} member{data.contributions.filter((c) => c.refunded > 0).length === 1 ? '' : 's'} when this vault closed.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}