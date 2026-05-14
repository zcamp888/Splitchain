'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Loader2, ExternalLink } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getExplorerTxUrl } from '@/lib/chains'
import { formatCurrency } from '@/lib/balances'

type Refund = {
  id: string
  member_address: string
  amount: number
  tx_hash: string
  occurred_at: string
  profile?: { display_name?: string | null; email?: string | null; wallet_address?: string | null } | null
}

function profileLabel(p: Refund['profile'], wallet: string): string {
  if (p?.display_name) return p.display_name
  if (p?.email && !p.email.endsWith('@wallet.splitchain.local')) return p.email.split('@')[0]
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
}

export function VaultRefunds({ vaultId, chainId }: { vaultId: string; chainId: number }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refunds, setRefunds] = useState<Refund[]>([])

  useEffect(() => {
    if (!expanded) return
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    supabase
      .from('vault_refunds')
      .select('id, member_address, amount, tx_hash, occurred_at, profiles:member_user_id(display_name, email, wallet_address)')
      .eq('vault_id', vaultId)
      .order('occurred_at', { ascending: false })
      .then(({ data }) => {
        setRefunds(
          (data || []).map((r: any) => ({
            ...r,
            amount: Number(r.amount),
            profile: r.profiles,
          }))
        )
        setLoading(false)
      })
  }, [expanded, vaultId])

  return (
    <div className="mt-4 border-t border-border/40 pt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-xs text-fg-muted transition-colors hover:bg-bg-elev/30 hover:text-fg"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-neon-cyan" aria-hidden="true" />
          Refund history
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="mt-3">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-fg-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            </div>
          ) : refunds.length === 0 ? (
            <p className="px-2 py-3 text-xs text-fg-dim">No refunds recorded yet. Try syncing.</p>
          ) : (
            <ul className="space-y-1.5">
              {refunds.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-bg-elev/20 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 truncate font-medium">
                    {profileLabel(r.profile, r.member_address)}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular font-mono font-semibold text-neon-cyan">
                      {formatCurrency(r.amount, 'USD')}
                    </span>
                    <a
                      href={getExplorerTxUrl(chainId, r.tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-fg-dim hover:text-neon-cyan"
                      aria-label="View refund tx"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}