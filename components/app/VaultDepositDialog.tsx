'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, AlertCircle, Wallet, CheckCircle2, ExternalLink, ArrowDownToLine } from 'lucide-react'
import {
  useAccount,
  useConnect,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi'
import { parseUnits, getAddress } from 'viem'
import { VAULT_ABI } from '@/lib/vaults/abi'
import { ERC20_ABI } from '@/lib/tokens'
import { chainName, getExplorerTxUrl } from '@/lib/chains'
import { useRecordVaultDeposit } from '@/lib/hooks/useVaults'
import type { Vault } from '@/lib/hooks/useVaults'
import { useToast } from '@/components/Toaster'
import { formatCurrency } from '@/lib/balances'

type Phase = 'form' | 'approving' | 'depositing' | 'done'

export function VaultDepositDialog({
  open,
  onClose,
  vault,
}: {
  open: boolean
  onClose: () => void
  vault: Vault
}) {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: switching } = useSwitchChain()

  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [approveTx, setApproveTx] = useState<`0x${string}` | null>(null)
  const [depositTx, setDepositTx] = useState<`0x${string}` | null>(null)

  const { writeContractAsync, isPending: writing } = useWriteContract()
  const { data: approveReceipt } = useWaitForTransactionReceipt({
    hash: approveTx || undefined,
    chainId: vault.chain_id,
  })
  const { data: depositReceipt } = useWaitForTransactionReceipt({
    hash: depositTx || undefined,
    chainId: vault.chain_id,
  })

  // Read wallet's USDC balance
  const { data: walletBalance } = useReadContract({
    address: vault.token_address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: vault.chain_id,
    query: { enabled: !!address && isConnected },
  })

  const record = useRecordVaultDeposit()
  const { push } = useToast()

  // Default to outstanding amount (target - already deposited)
  const myDeposited = vault.members.find((m) => m.wallet_address.toLowerCase() === address?.toLowerCase())
  const remainingTarget = Math.max(vault.target_per_member - 0, 0) // TODO: pull per-member deposited

  useEffect(() => {
    if (!open) return
    setAmount(vault.target_per_member > 0 ? vault.target_per_member.toString() : '')
    setPhase('form')
    setApproveTx(null)
    setDepositTx(null)
  }, [open, vault.target_per_member])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'form') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, phase])

  // After approval lands, kick off the deposit tx
  useEffect(() => {
    if (!approveReceipt || phase !== 'approving') return
    if (approveReceipt.status !== 'success') {
      push({ kind: 'error', message: 'Approval reverted' })
      setPhase('form')
      return
    }
    ;(async () => {
      try {
        const amt = parseUnits(amount, vault.token_decimals)
        const hash = await writeContractAsync({
          address: vault.contract_address as `0x${string}`,
          abi: VAULT_ABI,
          functionName: 'deposit',
          args: [amt],
          chainId: vault.chain_id,
        })
        setDepositTx(hash)
        setPhase('depositing')
      } catch (e: any) {
        push({ kind: 'error', message: e?.shortMessage || e?.message || 'Deposit failed' })
        setPhase('form')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveReceipt])

  // After deposit lands, record to DB
  useEffect(() => {
    if (!depositReceipt || phase !== 'depositing' || !depositTx) return
    if (depositReceipt.status !== 'success') {
      push({ kind: 'error', message: 'Deposit reverted' })
      setPhase('form')
      return
    }

    // Find the Deposited event log index for idempotent recording
    const logIndex = depositReceipt.logs.findIndex(
      (l) => l.address.toLowerCase() === vault.contract_address.toLowerCase()
    )

    record
      .mutateAsync({
        vault_id: vault.id,
        group_id: vault.group_id,
        member_address: address || '',
        amount: parseFloat(amount),
        tx_hash: depositTx,
        block_number: Number(depositReceipt.blockNumber),
        log_index: logIndex >= 0 ? logIndex : 0,
      })
      .then(() => {
        setPhase('done')
        push({ kind: 'success', message: 'Deposit confirmed ✓' })
      })
      .catch((e) => {
        // Even if DB write fails, on-chain succeeded — show done state
        push({ kind: 'info', message: `On-chain deposit confirmed (DB sync: ${e.message})` })
        setPhase('done')
      })
  }, [depositReceipt, phase, depositTx, vault, address, amount, record, push])

  if (!open) return null

  const numericAmount = parseFloat(amount) || 0
  const walletBalanceFormatted = walletBalance
    ? Number(walletBalance) / 10 ** vault.token_decimals
    : 0
  const insufficientBalance = numericAmount > walletBalanceFormatted
  const wrongChain = isConnected && currentChainId !== vault.chain_id
  const isMember = vault.members.some(
    (m) => m.wallet_address.toLowerCase() === address?.toLowerCase()
  )

  const handleDeposit = async () => {
    try {
      if (!isConnected || !address) throw new Error('Connect wallet')
      if (!isMember) throw new Error('Your wallet is not a member of this vault')
      if (numericAmount <= 0) throw new Error('Amount must be greater than 0')
      if (insufficientBalance) throw new Error('Insufficient wallet balance')

      if (currentChainId !== vault.chain_id) {
        await switchChainAsync({ chainId: vault.chain_id })
      }

      const amt = parseUnits(amount, vault.token_decimals)

      // Step 1: approve
      setPhase('approving')
      const hash = await writeContractAsync({
        address: vault.token_address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve' as any,
        args: [vault.contract_address as `0x${string}`, amt] as any,
        chainId: vault.chain_id,
      } as any)
      setApproveTx(hash)
    } catch (e: any) {
      push({ kind: 'error', message: e?.shortMessage || e?.message || 'Failed' })
      setPhase('form')
    }
  }

  const busy = writing || switching

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deposit-title"
      onClick={() => phase === 'form' && onClose()}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="deposit-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <ArrowDownToLine className="h-5 w-5 text-neon-lime" aria-hidden="true" />
              Deposit to vault
            </h2>
            <p className="mt-1 text-xs text-fg-muted">{vault.name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={phase !== 'form' && phase !== 'done'}
            className="text-fg-muted hover:text-fg disabled:opacity-30"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {phase === 'done' ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <span>Deposited {formatCurrency(numericAmount, 'USD')} USDC</span>
            </div>
            {depositTx && (
              <a
                href={getExplorerTxUrl(vault.chain_id, depositTx)}
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
            <p className="text-sm text-fg-muted">Connect a wallet to deposit.</p>
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
            <span>Your connected wallet ({address?.slice(0, 6)}…{address?.slice(-4)}) is not a member of this vault.</span>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-border-strong bg-bg-elev/40 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-fg-muted">Target per member</span>
                <span className="tabular font-mono text-lg font-bold">
                  {formatCurrency(vault.target_per_member, 'USD')} USDC
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between text-xs">
                <span className="text-fg-dim">Your wallet balance</span>
                <span className="tabular font-mono text-fg-muted">
                  {walletBalanceFormatted.toFixed(2)} USDC
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="dep-amount" className="mb-1.5 block text-xs text-fg-muted">
                Amount (USDC)
              </label>
              <input
                id="dep-amount"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={phase !== 'form'}
                className="input-base tabular font-mono"
                placeholder="0.00"
              />
              {insufficientBalance && numericAmount > 0 && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-danger">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  Insufficient balance — top up your wallet first.
                </p>
              )}
            </div>

            {wrongChain && (
              <div className="flex items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                <span>Wallet is on {chainName(currentChainId)} — will switch to {chainName(vault.chain_id)}.</span>
              </div>
            )}

            {phase === 'approving' && (
              <div className="flex items-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2.5 text-sm">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neon-cyan" aria-hidden="true" />
                <span>Step 1/2 — approving USDC…</span>
              </div>
            )}

            {phase === 'depositing' && (
              <div className="flex items-center gap-2 rounded-xl border border-neon-violet/30 bg-neon-violet/5 px-3 py-2.5 text-sm">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neon-violet" aria-hidden="true" />
                <span>Step 2/2 — depositing…</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} disabled={phase !== 'form'} className="btn-ghost">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeposit}
                disabled={busy || phase !== 'form' || !numericAmount || insufficientBalance}
                className="btn-primary"
              >
                {busy || phase !== 'form' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Working…
                  </>
                ) : (
                  <>Deposit {numericAmount > 0 ? numericAmount.toFixed(2) : ''} USDC</>
                )}
              </button>
            </div>

            <p className="text-center text-[10px] text-fg-dim">
              Two transactions required: first approves USDC, second deposits.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}