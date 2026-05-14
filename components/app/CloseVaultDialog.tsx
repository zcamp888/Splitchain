'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, AlertTriangle, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react'
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { formatUnits, decodeEventLog } from 'viem'
import { VAULT_ABI } from '@/lib/vaults/abi'
import { chainName, getExplorerTxUrl } from '@/lib/chains'
import { useMarkVaultClosed } from '@/lib/hooks/useVaults'
import { useVaultSync } from '@/lib/hooks/useVaultSync'
import type { Vault } from '@/lib/hooks/useVaults'
import { useToast } from '@/components/Toaster'
import { formatCurrency } from '@/lib/balances'

type RefundPreview = {
  member: string
  amount: number
}

export function CloseVaultDialog({
  open,
  onClose,
  vault,
}: {
  open: boolean
  onClose: () => void
  vault: Vault
}) {
  const { address, isConnected } = useAccount()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: switching } = useSwitchChain()

  const [step, setStep] = useState<'preview' | 'pending' | 'done'>('preview')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [refunds, setRefunds] = useState<RefundPreview[]>([])

  const { writeContractAsync, isPending: writing } = useWriteContract()
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
    chainId: vault.chain_id,
  })

  const markClosed = useMarkVaultClosed()
  const sync = useVaultSync()
  const { push } = useToast()

  const isOwner = address?.toLowerCase() === vault.owner_address.toLowerCase()

  // Proportional refund preview (matches contract math)
  const refundPool = vault.remaining_balance
  const totalDep = vault.total_deposited

  useEffect(() => {
    if (!open) return
    setStep('preview')
    setTxHash(null)
    setRefunds([])
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'pending') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, step])

  // Parse Refunded events from receipt
  useEffect(() => {
    if (!receipt || !txHash) return
    if (receipt.status !== 'success') {
      push({ kind: 'error', message: 'Close transaction reverted' })
      setStep('preview')
      return
    }

    const parsedRefunds: RefundPreview[] = []
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: VAULT_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'Refunded') {
          const args: any = decoded.args
          parsedRefunds.push({
            member: (args.member as string).toLowerCase(),
            amount: Number(formatUnits(args.amount as bigint, vault.token_decimals)),
          })
        }
      } catch {
        // skip non-vault logs
      }
    }
    setRefunds(parsedRefunds)

    // Mark closed locally + trigger full sync to capture all refunds
    markClosed
      .mutateAsync({
        vault_id: vault.id,
        group_id: vault.group_id,
        close_tx_hash: txHash,
      })
      .then(() => sync.mutateAsync({ vault_id: vault.id }))
      .then(() => {
        setStep('done')
        push({ kind: 'success', message: 'Vault closed · refunds sent' })
      })
      .catch(() => {
        setStep('done')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, txHash])

  if (!open) return null

  const handleClose = async () => {
    try {
      if (!isOwner) throw new Error('Only the vault owner can close it')
      if (currentChainId !== vault.chain_id) {
        await switchChainAsync({ chainId: vault.chain_id })
      }

      setStep('pending')

      const hash = await writeContractAsync({
        address: vault.contract_address as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'close',
        chainId: vault.chain_id,
      })
      setTxHash(hash)
    } catch (e: any) {
      push({ kind: 'error', message: e?.shortMessage || e?.message || 'Close failed' })
      setStep('preview')
    }
  }

  const busy = writing || switching

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-vault-title"
      onClick={() => step !== 'pending' && onClose()}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="close-vault-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <Sparkles className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
              Close vault
            </h2>
            <p className="mt-1 text-xs text-fg-muted">{vault.name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'pending'}
            className="text-fg-muted hover:text-fg disabled:opacity-30"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {step === 'done' ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <span>Vault closed and refunds sent to all members.</span>
            </div>

            {refunds.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs uppercase tracking-wider text-fg-muted">Refunds sent</h3>
                <ul className="space-y-1.5">
                  {refunds.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-bg-elev/30 px-3 py-2 text-xs">
                      <span className="font-mono text-fg-muted">
                        {r.member.slice(0, 6)}…{r.member.slice(-4)}
                      </span>
                      <span className="tabular font-mono font-semibold text-neon-cyan">
                        {formatCurrency(r.amount, 'USD')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {txHash && (
              <a
                href={getExplorerTxUrl(vault.chain_id, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-neon-cyan"
              >
                View close tx <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {!isOwner && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                <span>Only the vault owner can close it.</span>
              </div>
            )}

            <div className="rounded-2xl border border-border-strong bg-bg-elev/40 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-fg-muted">Pool to refund</span>
                <span className="tabular font-mono text-2xl font-bold text-neon-cyan">
                  {formatCurrency(refundPool, 'USD')} USDC
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs">
                <div>
                  <div className="text-fg-dim">Total deposited</div>
                  <div className="mt-0.5 tabular font-mono font-semibold">
                    {formatCurrency(totalDep, 'USD')}
                  </div>
                </div>
                <div>
                  <div className="text-fg-dim">Total claimed</div>
                  <div className="mt-0.5 tabular font-mono font-semibold">
                    {formatCurrency(vault.total_claimed, 'USD')}
                  </div>
                </div>
              </div>
            </div>

            {refundPool > 0 && totalDep > 0 && (
              <div>
                <h3 className="mb-2 text-xs uppercase tracking-wider text-fg-muted">Refund preview (pro-rata)</h3>
                <ul className="space-y-1.5">
                  {vault.members.map((m) => {
                    // Per-member deposit isn't aggregated client-side; preview shows equal split fallback.
                    // The contract math uses actual deposits — preview here is illustrative.
                    const equalShare = refundPool / vault.members.length
                    return (
                      <li key={m.wallet_address} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-bg-elev/30 px-3 py-2 text-xs">
                        <span className="font-mono text-fg-muted">
                          {m.wallet_address.slice(0, 6)}…{m.wallet_address.slice(-4)}
                        </span>
                        <span className="tabular font-mono">
                          ~{formatCurrency(equalShare, 'USD')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-2 text-[10px] text-fg-dim">
                  Estimates shown. The contract refunds proportional to each member&rsquo;s actual deposit.
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
              <span>
                <strong>This is permanent.</strong> Once closed, no more deposits or claims are possible.
                {currentChainId !== vault.chain_id && <> Wallet will switch to {chainName(vault.chain_id)}.</>}
              </span>
            </div>

            {step === 'pending' && txHash && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-neon-violet/30 bg-neon-violet/5 px-3 py-2.5 text-sm">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neon-violet" aria-hidden="true" />
                  <span>Closing vault & refunding members…</span>
                </div>
                <a
                  href={getExplorerTxUrl(vault.chain_id, txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-neon-cyan"
                >
                  View on explorer <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={step === 'pending'}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={busy || step !== 'preview' || !isOwner}
                className="btn-primary bg-gradient-to-br from-danger to-danger/80 from-danger to-danger/80"
              >
                {busy || step === 'pending' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Closing…
                  </>
                ) : (
                  'Close vault & refund'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}