'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Lock, Plus, ArrowDownToLine, ExternalLink, Users, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useGroupVaults, type Vault } from '@/lib/hooks/useVaults'
import { CreateVaultDialog } from '@/components/app/CreateVaultDialog'
import { VaultDepositDialog } from '@/components/app/VaultDepositDialog'
import { getExplorerTxUrl, chainName } from '@/lib/chains'
import { formatCurrency } from '@/lib/balances'
import { getFactoryAddress } from '@/lib/vaults/config'
import { base, baseSepolia } from 'wagmi/chains'

function VaultCard({
  vault,
  onDeposit,
}: {
  vault: Vault
  onDeposit: (v: Vault) => void
}) {
  const totalTarget = vault.target_per_member * vault.members.length
  const depositPct = totalTarget > 0 ? Math.min((vault.total_deposited / totalTarget) * 100, 100) : 0
  const isClosed = vault.status === 'closed'

  return (
    <div className={`rounded-2xl border p-5 transition-all ${isClosed ? 'border-border bg-bg-elev/20 opacity-70' : 'border-neon-violet/20 bg-gradient-to-br from-neon-violet/5 to-neon-cyan/5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0 text-neon-violet" aria-hidden="true" />
            <h3 className="truncate font-display font-semibold">{vault.name}</h3>
            {isClosed && (
              <span className="shrink-0 rounded-full border border-fg-dim/30 bg-bg-elev px-2 py-0.5 text-[10px] text-fg-muted">
                closed
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {vault.members.length} members
            </span>
            <span>·</span>
            <span>{chainName(vault.chain_id)}</span>
            <span>·</span>
            <a
              href={getExplorerTxUrl(vault.chain_id, vault.deploy_tx_hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-neon-cyan"
            >
              {vault.contract_address.slice(0, 6)}…{vault.contract_address.slice(-4)}
              <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
            </a>
          </div>
        </div>
        {!isClosed && (
          <button
            onClick={() => onDeposit(vault)}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-neon-violet to-neon-cyan px-3 py-1.5 text-xs font-medium text-bg shadow-sm transition-shadow hover:shadow-neon-violet/30"
          >
            <ArrowDownToLine className="h-3 w-3" aria-hidden="true" />
            Deposit
          </button>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="text-fg-muted">Pool</span>
          <span className="tabular font-mono">
            <span className="font-semibold text-neon-lime">{formatCurrency(vault.total_deposited, 'USD')}</span>
            <span className="text-fg-dim"> / {formatCurrency(totalTarget, 'USD')} USDC</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-elev">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan transition-all"
            style={{ width: `${depositPct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/40 pt-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-fg-dim">Deposited</div>
          <div className="mt-0.5 tabular font-mono text-sm font-semibold">
            {formatCurrency(vault.total_deposited, 'USD')}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-fg-dim">Claimed</div>
          <div className="mt-0.5 tabular font-mono text-sm font-semibold">
            {formatCurrency(vault.total_claimed, 'USD')}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-fg-dim">Available</div>
          <div className="mt-0.5 tabular font-mono text-sm font-semibold text-neon-lime">
            {formatCurrency(vault.remaining_balance, 'USD')}
          </div>
        </div>
      </div>
    </div>
  )
}

export function VaultSection({
  groupId,
  groupName,
  members,
}: {
  groupId: string
  groupName: string
  members: any[]
}) {
  const [expanded, setExpanded] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [depositVault, setDepositVault] = useState<Vault | null>(null)
  const { data: vaults, isLoading } = useGroupVaults(groupId)

  const factoryConfigured = !!(getFactoryAddress(base.id) || getFactoryAddress(baseSepolia.id))
  const hasVaults = vaults && vaults.length > 0
  const activeVaults = vaults?.filter((v) => v.status === 'active') || []

  if (!factoryConfigured && !hasVaults) {
    // Don't show the section at all if vaults aren't configured and none exist
    return null
  }

  return (
    <section className="glass overflow-hidden rounded-2xl">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-bg-elev/30"
        aria-expanded={expanded}
        aria-controls="vault-section-content"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet/20 to-neon-cyan/20 text-neon-violet">
            <Lock className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold">Group vaults</h2>
            <p className="text-xs text-fg-muted">
              {hasVaults ? (
                <>
                  {activeVaults.length} active{activeVaults.length !== vaults!.length && ` · ${vaults!.length - activeVaults.length} closed`}
                </>
              ) : (
                'Pool USDC upfront for trips · on-chain escrow'
              )}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div id="vault-section-content" className="border-t border-border/40 px-5 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-fg-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            </div>
          ) : !hasVaults ? (
            <div className="text-center">
              <p className="mx-auto max-w-sm text-sm text-fg-muted">
                Create a vault so everyone deposits upfront. Anyone can claim reimbursement during the trip, and remaining balance refunds proportionally on close.
              </p>
              {factoryConfigured ? (
                <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 mx-auto">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create vault
                </button>
              ) : (
                <div className="mx-auto mt-4 flex max-w-sm items-start gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-left text-xs">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                  <span>
                    Vault factory not deployed yet. See <code className="font-mono">contracts/DEPLOY.md</code> to deploy to Base.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {vaults!.map((v) => (
                <VaultCard key={v.id} vault={v} onDeposit={setDepositVault} />
              ))}
              {factoryConfigured && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-bg-elev/20 px-4 py-3 text-sm text-fg-muted transition-colors hover:border-neon-violet/40 hover:text-fg"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add another vault
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <CreateVaultDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        groupId={groupId}
        groupName={groupName}
        members={members}
      />
      {depositVault && (
        <VaultDepositDialog
          open={!!depositVault}
          onClose={() => setDepositVault(null)}
          vault={depositVault}
        />
      )}
    </section>
  )
}