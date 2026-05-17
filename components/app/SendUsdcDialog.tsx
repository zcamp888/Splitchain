'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  X, Loader2, ExternalLink, AlertCircle, CheckCircle2, Wallet, Send, ArrowDown,
} from 'lucide-react'
import {
  useAccount,
  useConnect,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi'
import { parseUnits, isAddress, getAddress, formatUnits } from 'viem'
import { SUPPORTED_CHAINS, getExplorerTxUrl, chainName } from '@/lib/chains'
import { USDC_BY_CHAIN, ERC20_ABI } from '@/lib/tokens'
import { useCreateSettlement } from '@/lib/hooks'
import { displayName } from '@/lib/displayName'
import { useToast } from '@/components/Toaster'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { formatCurrency } from '@/lib/balances'

type RecipientOption = {
  kind: 'member' | 'external'
  userId?: string
  address: `0x${string}`
  label: string
  sublabel?: string
}

export function SendUsdcDialog({
  open,
  onClose,
  groupId,
  groupMembers,
  currentUserId,
}: {
  open: boolean
  onClose: () => void
  groupId?: string
  groupMembers?: any[]
  currentUserId: string | null
}) {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: switching } = useSwitchChain()

  const [recipientInput, setRecipientInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolved, setResolved] = useState<RecipientOption | null>(null)
  const [amount, setAmount] = useState('')
  const [chainId, setChainId] = useState<number>(SUPPORTED_CHAINS[0].id)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [recorded, setRecorded] = useState(false)

  const { writeContractAsync, isPending: sending } = useWriteContract()
  const { data: receipt, isLoading: confirming } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
    chainId,
  })

  const usdc = USDC_BY_CHAIN[chainId]
  const { data: balanceData } = useReadContract({
    address: usdc?.address || undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address && isConnected && !!usdc },
  })

  const createSettlement = useCreateSettlement(groupId || '')
  const { push } = useToast()
  useBodyScrollLock(open)

  // Eligible group members (excluding self, must have wallet)
  const memberOptions = useMemo<RecipientOption[]>(() => {
    if (!groupMembers) return []
    return groupMembers
      .filter((m: any) => m.user_id !== currentUserId && m.profile?.wallet_address)
      .map((m: any) => ({
        kind: 'member' as const,
        userId: m.user_id,
        address: getAddress(m.profile.wallet_address),
        label: displayName(m.profile),
        sublabel: `${m.profile.wallet_address.slice(0, 6)}…${m.profile.wallet_address.slice(-4)}`,
      }))
  }, [groupMembers, currentUserId])

  useEffect(() => {
    if (open) {
      setRecipientInput('')
      setResolved(null)
      setAmount('')
      setChainId(SUPPORTED_CHAINS[0].id)
      setTxHash(null)
      setRecorded(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending && !confirming) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, sending, confirming])

  // Auto-record settlement once tx confirms (only for group members)
  useEffect(() => {
    if (!receipt || recorded || !txHash || !resolved) return
    if (receipt.status !== 'success') return
    if (resolved.kind !== 'member' || !groupId || !currentUserId) {
      setRecorded(true)
      return
    }
    setRecorded(true)
    createSettlement
      .mutateAsync({
        from_user: currentUserId,
        to_user: resolved.userId!,
        amount: parseFloat(amount),
        currency: 'USD',
        status: 'confirmed',
        method: 'onchain',
        chain_id: chainId,
        token_symbol: 'USDC',
        token_address: usdc.address,
        tx_hash: txHash,
        from_address: address?.toLowerCase() || null,
        to_address: resolved.address.toLowerCase(),
      } as any)
      .then(() => push({ kind: 'success', message: 'Settlement recorded' }))
      .catch((e) => push({ kind: 'error', message: e instanceof Error ? e.message : 'Recording failed' }))
  }, [receipt, recorded, txHash, resolved, groupId, currentUserId, amount, chainId, usdc, address, createSettlement, push])

  if (!open) return null

  const resolveRecipient = async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) {
      setResolved(null)
      return
    }

    // Try matching a group member first
    const lower = trimmed.toLowerCase()
    const memberMatch = memberOptions.find(
      (m) => m.address.toLowerCase() === lower || m.label.toLowerCase() === lower
    )
    if (memberMatch) {
      setResolved(memberMatch)
      return
    }

    // Raw address
    if (isAddress(trimmed)) {
      setResolved({
        kind: 'external',
        address: getAddress(trimmed),
        label: `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`,
        sublabel: 'External wallet',
      })
      return
    }

    // ENS or email-like input
    if (trimmed.includes('.')) {
      setResolving(true)
      try {
        const res = await fetch('/api/ens/resolve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: trimmed }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not resolve')
        setResolved({
          kind: 'external',
          address: getAddress(json.address),
          label: trimmed,
          sublabel: `${json.address.slice(0, 6)}…${json.address.slice(-4)}`,
        })
      } catch (e) {
        push({ kind: 'error', message: e instanceof Error ? e.message : 'Resolve failed' })
        setResolved(null)
      } finally {
        setResolving(false)
      }
      return
    }

    setResolved(null)
  }

  const handleSend = async () => {
    try {
      if (!resolved) throw new Error('Choose a recipient')
      if (!usdc) throw new Error('USDC not available on this chain')
      const n = parseFloat(amount)
      if (isNaN(n) || n <= 0) throw new Error('Enter an amount')

      if (currentChainId !== chainId) {
        await switchChainAsync({ chainId })
      }

      const hash = await writeContractAsync({
        address: usdc.address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [resolved.address, parseUnits(amount, usdc.decimals)],
        chainId,
      })
      setTxHash(hash)
      push({ kind: 'info', message: 'Transaction submitted' })
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Transaction failed'
      push({ kind: 'error', message: msg })
    }
  }

  const walletBalance = balanceData && usdc
    ? Number(formatUnits(balanceData as bigint, usdc.decimals))
    : 0
  const numericAmount = parseFloat(amount) || 0
  const insufficient = numericAmount > walletBalance
  const status = receipt
    ? receipt.status === 'success' ? 'confirmed' : 'failed'
    : txHash ? 'pending' : 'idle'
  const wrongChain = isConnected && currentChainId !== chainId

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-usdc-title"
      onClick={() => status === 'idle' && !sending && onClose()}
    >
      <div
        className="sheet-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="sheet-header">
          <div>
            <h2 id="send-usdc-title" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight sm:text-xl">
              <Send className="h-5 w-5 text-neon-lime" aria-hidden="true" />
              Send USDC
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">Pay anyone on Base, Polygon, Mainnet, or Optimism.</p>
          </div>
          <button
            onClick={onClose}
            disabled={sending || confirming}
            className="btn-icon -mr-2 text-fg-muted hover:text-fg disabled:opacity-30"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-5 py-5">
          {!isConnected ? (
            <div className="space-y-2">
              <p className="text-sm text-fg-muted">Connect a wallet to send USDC.</p>
              {connectors.map((c) => (
                <button key={c.uid} onClick={() => connect({ connector: c })} className="btn-ghost w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    {c.name}
                  </span>
                </button>
              ))}
            </div>
          ) : status === 'confirmed' && txHash ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <span>Sent {formatCurrency(numericAmount, 'USD')} USDC to {resolved?.label}</span>
              </div>
              <a
                href={getExplorerTxUrl(chainId, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-neon-cyan"
              >
                {txHash.slice(0, 10)}…{txHash.slice(-8)} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          ) : (
            <>
              {/* Recipient picker */}
              <div>
                <label className="mb-1.5 block text-xs text-fg-muted">Send to</label>

                {memberOptions.length > 0 && !resolved && (
                  <div className="mb-2 space-y-1">
                    <span className="block text-[10px] uppercase tracking-wider text-fg-dim">Group members</span>
                    {memberOptions.map((m) => (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => {
                          setResolved(m)
                          setRecipientInput(m.label)
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border-strong bg-bg-elev/40 px-3 py-2.5 text-left text-sm transition-colors hover:border-neon-violet/40 hover:bg-bg-elev"
                      >
                        <span className="min-w-0 flex-1 truncate">{m.label}</span>
                        <span className="shrink-0 font-mono text-xs text-fg-dim">{m.sublabel}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    value={recipientInput}
                    onChange={(e) => {
                      setRecipientInput(e.target.value)
                      setResolved(null)
                    }}
                    onBlur={() => resolveRecipient(recipientInput)}
                    placeholder="0x…, vitalik.eth, or paste address"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={status !== 'idle'}
                    className="input-base font-mono text-sm"
                    aria-label="Recipient address or ENS name"
                  />
                  {resolving && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-fg-muted" aria-hidden="true" />
                  )}
                </div>

                {resolved && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{resolved.label}</div>
                      <div className="truncate font-mono text-[10px] text-fg-dim">{resolved.address}</div>
                    </div>
                    {resolved.kind === 'member' ? (
                      <span className="shrink-0 rounded-full bg-neon-violet/10 px-2 py-0.5 text-[10px] font-medium text-neon-violet">
                        member
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-bg-elev px-2 py-0.5 text-[10px] text-fg-muted">
                        external
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Network */}
              <div>
                <label htmlFor="send-chain" className="mb-1.5 block text-xs text-fg-muted">Network</label>
                <select
                  id="send-chain"
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  disabled={status !== 'idle'}
                  className="input-base"
                  style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
                >
                  {SUPPORTED_CHAINS.filter((c) => !!USDC_BY_CHAIN[c.id]).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <label htmlFor="send-amount" className="block text-xs text-fg-muted">Amount (USDC)</label>
                  <button
                    type="button"
                    onClick={() => setAmount(walletBalance.toFixed(2))}
                    className="text-[10px] uppercase tracking-wider text-neon-cyan hover:text-fg"
                  >
                    Max: {walletBalance.toFixed(2)}
                  </button>
                </div>
                <input
                  id="send-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={status !== 'idle'}
                  placeholder="0.00"
                  className="input-base tabular font-mono text-lg sm:text-base"
                />
                {insufficient && numericAmount > 0 && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-danger">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    Insufficient balance on {chainName(chainId)}.
                  </p>
                )}
              </div>

              {/* Summary */}
              {resolved && numericAmount > 0 && !insufficient && (
                <div className="rounded-2xl border border-border-strong bg-bg-elev/40 p-4">
                  <div className="flex items-center justify-between text-xs text-fg-muted">
                    <span>You send</span>
                    <span className="tabular font-mono text-base font-semibold text-fg">
                      {numericAmount.toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="my-2 flex justify-center">
                    <ArrowDown className="h-3.5 w-3.5 text-fg-dim" aria-hidden="true" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-fg-muted">
                    <span>{resolved.label} receives</span>
                    <span className="tabular font-mono text-base font-semibold text-neon-lime">
                      {numericAmount.toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="mt-3 border-t border-border/40 pt-3 text-[10px] text-fg-dim">
                    on {chainName(chainId)} · {resolved.kind === 'member' ? 'auto-records as settlement' : 'standalone transfer'}
                  </div>
                </div>
              )}

              {wrongChain && (
                <div className="flex items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                  <span>Wallet on {chainName(currentChainId)} — will switch to {chainName(chainId)}.</span>
                </div>
              )}

              {status === 'pending' && txHash && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2.5 text-sm">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neon-cyan" aria-hidden="true" />
                    <span>Waiting for confirmation…</span>
                  </div>
                  <a
                    href={getExplorerTxUrl(chainId, txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-neon-cyan"
                  >
                    View on explorer <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              )}

              {status === 'failed' && (
                <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                  <span>Transaction failed. Try again.</span>
                </div>
              )}
            </>
          )}
        </div>

        {isConnected && status !== 'confirmed' && (
          <div className="sheet-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={sending || confirming}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || switching || confirming || !resolved || !numericAmount || insufficient || status !== 'idle'}
              className="btn-primary flex-1"
            >
              {sending || switching || confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Send
                </>
              )}
            </button>
          </div>
        )}

        {isConnected && status === 'confirmed' && (
          <div className="sheet-footer">
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}