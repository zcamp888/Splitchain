'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, AlertCircle, Wallet, CheckCircle2, ExternalLink, Zap } from 'lucide-react'
import {
  useAccount,
  useConnect,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseUnits } from 'viem'
import { VAULT_ABI } from '@/lib/vaults/abi'
import { chainName, getExplorerTxUrl } from '@/lib/chains'
import { useRecordVaultClaim } from '@/lib/hooks/useVaults'
import type { Vault } from '@/lib/hooks/useVaults'
import { uuidToBytes32 } from '@/lib/vaults/utils'
import { useToast } from '@/components/Toaster'
import { formatCurrency } from '@/lib/balances'

export function VaultClaimDialog({
  open,
  onClose,
  vault,
  expense,
}: {
  open: boolean
  onClose: () => void
  vault: Vault
  expense: { id: string; description: string; amount: number; currency: string } | null
}) {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: switching } = useSwitchChain()

  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'form' | 'pending' | 'done'>('form')

  const { writeContractAsync, isPending: writing } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
    chainId: vault.chain_id,
  })

  const record = useRecordVaultClaim()
  const { push } = useToast()

  useEffect(() => {
    if (!open || !expense) return
    setAmount(expense.amount.toString())
    setStep('form')
    setTxHash(null)
  }, [open, expense])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'pending') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, step])

  useEffect(() => {
    if (!receipt || !txHash || !expense) return
    if (receipt.status !== 'success') {
      push({ kind: 'error', message: 'Claim reverted' })
      setStep('form')
      return
    }

    const logIndex = receipt.logs.findIndex(
      (l) => l.address.toLowerCase() === vault.contract_address.toLowerCase()
    )

    record
      .mutateAsync({
        vault_id: vault.id,
        group_id: vault.group_id,
        claimer_address: address || '',
        amount: parseFloat(amount),
        expense_id_bytes32: uuidToBytes32(expense.id),
        expense_id: expense.id,
        tx_hash: txHash,
        block_number: Number(receipt.blockNumber),
        log_index: logIndex >= 0 ? logIndex : 0,
      })
      .then(() => {
        setStep('done')
        push({ kind: 'success', message: 'Reimbursement claimed ✓' })
      })
      .catch(() => {
        setStep('done')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, txHash])

  if (!open || !expense) return null

  const numericAmount = parseFloat(amount) || 0
  const overdraw = numericAmount > vault.remaining_balance
  const wrongChain = isConnected && currentChainId !== vault.chain_id
  const isMember = vault.members.some(
    (m) => m.wallet_address.toLowerCase() === address?.toLowerCase()
  )

  const handleClaim = async () => {
    try {
      if (!isConnected || !address) throw new Error('Connect wallet')
      if (!isMember) throw new Error('Your wallet is not a vault member')
      if (numericAmount <= 0) throw new Error('Amount must be greater than 0')
      if (overdraw) throw new Error('Exceeds remaining vault balance')

      if (currentChainId !== vault.chain_id) {
        await switchChainAsync({ chainId: vault.chain_id })
      }

      setStep('pending')

      const amt = parseUnits(amount, vault.token_decimals)
      const expenseHash = uuidToBytes32(expense.id)

      const hash = await writeContractAsync({
        address: vault.contract_address as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'claimReimbursement',
        args: [amt, expenseHash],
        chainId: vault.chain_id,
      })
      setTxHash(hash)
    } catch (e: any) {
      push({ kind: 'error', message: e?.shortMessage || e?.message || 'Claim failed' })
      setStep('form')
    }
  }

  const busy = writing || switching

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-title"
      onClick={() => step === 'form' && onClose()}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="claim-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <Zap className="h-5 w-5 text-neon-violet" aria-hidden="true" />
              Claim from vault
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
              <span>Reimbursement of {formatCurrency(numericAmount, 'USD')} sent to your wallet</span>
            </div>
            {txHash && (
              <a
                href={getExplorerTxUrl(vault.chain_id, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-neon-cyan"
              >
                View tx <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        ) : !isConnected ? (
          <div className="mt-5 space-y-2">
            <p className="text-sm text-fg-muted">Connect a wallet to claim.</p>
            {connectors.map((c) => (
              <button key={c.uid} onClick={() => connect({ connector: c })} className="btn-ghost w-full justify-between">
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        ) : !isMember ? (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            <span>Your connected wallet is not a member of this vault.</span>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-border-strong bg-bg-elev/40 p-4">
              <div className="text-xs text-fg-muted">Reimbursing</div>
              <div className="mt-1 truncate font-display font-semibold">{expense.description}</div>
              <div className="mt-1 text-xs text-fg-dim">
                Original: {formatCurrency(expense.amount, expense.currency)}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-elev/30 p-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-fg-muted">Vault balance available</span>
                <span className="tabular font-mono font-semibold text-neon-lime">
                  {formatCurrency(vault.remaining_balance, 'USD')} USDC
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="claim-amount" className="mb-1.5 block text-xs text-fg-muted">
                Claim amount (USDC)
              </label>
              <input
                id="claim-amount"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={step !== 'form'}
                className="input-base tabular font-mono"
              />
              {overdraw && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-danger">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  Exceeds vault balance — claim a smaller amount.
                </p>
              )}
            </div>

            {wrongChain && (
              <div className="flex items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                <span>Wallet is on {chainName(currentChainId)} — will switch to {chainName(vault.chain_id)}.</span>
              </div>
            )}

            {step === 'pending' && txHash && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-neon-violet/30 bg-neon-violet/5 px-3 py-2.5 text-sm">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neon-violet" aria-hidden="true" />
                  <span>Claiming reimbursement…</span>
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
              <button type="button" onClick={onClose} disabled={step !== 'form'} className="btn-ghost">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClaim}
                disabled={busy || step !== 'form' || !numericAmount || overdraw}
                className="btn-primary"
              >
                {busy || step === 'pending' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Claiming…
                  </>
                ) : (
                  <>Claim {numericAmount > 0 ? numericAmount.toFixed(2) : ''} USDC</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}