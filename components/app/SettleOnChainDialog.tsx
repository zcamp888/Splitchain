'use client'

// @integration: supabase
import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, ExternalLink, AlertCircle, CheckCircle2, Wallet } from 'lucide-react'
import {
  useAccount,
  useConnect,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseEther, parseUnits, isAddress, getAddress } from 'viem'
import { SUPPORTED_CHAINS, getExplorerTxUrl, chainName } from '@/lib/chains'
import { getTokenOptions, ERC20_ABI, type TokenConfig } from '@/lib/tokens'
import { useCreateSettlement } from '@/lib/hooks'
import { useToast } from '@/components/Toaster'
import { formatCurrency } from '@/lib/balances'

export function SettleOnChainDialog({
  open,
  onClose,
  groupId,
  fromUserId,
  toUserId,
  toProfile,
  amount,
  currency,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  fromUserId: string
  toUserId: string
  toProfile: { display_name?: string | null; wallet_address?: string | null; email?: string | null } | null
  amount: number
  currency: string
}) {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const [chainId, setChainId] = useState<number>(SUPPORTED_CHAINS[0].id)
  const [token, setToken] = useState<TokenConfig>(getTokenOptions(SUPPORTED_CHAINS[0].id)[0])

  const { sendTransactionAsync, isPending: sendingNative } = useSendTransaction()
  const { writeContractAsync, isPending: sendingErc } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const { data: receipt, isLoading: confirming } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
    chainId,
  })

  const createSettlement = useCreateSettlement(groupId)
  const { push } = useToast()
  const [recorded, setRecorded] = useState(false)

  const tokenOptions = useMemo(() => getTokenOptions(chainId), [chainId])
  const recipientAddress = toProfile?.wallet_address ? getAddress(toProfile.wallet_address) : null
  const recipientLabel =
    toProfile?.display_name ||
    toProfile?.email ||
    (recipientAddress ? `${recipientAddress.slice(0, 6)}…${recipientAddress.slice(-4)}` : 'Member')

  useEffect(() => {
    if (open) {
      setTxHash(null)
      setRecorded(false)
      setChainId(SUPPORTED_CHAINS[0].id)
      setToken(getTokenOptions(SUPPORTED_CHAINS[0].id)[0])
    }
  }, [open])

  useEffect(() => {
    setToken(getTokenOptions(chainId)[0])
  }, [chainId])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sendingNative && !sendingErc && !confirming) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, sendingNative, sendingErc, confirming])

  // Auto-record settlement once tx is confirmed
  useEffect(() => {
    if (!receipt || recorded || !txHash) return
    if (receipt.status !== 'success') return
    setRecorded(true)
    createSettlement
      .mutateAsync({
        from_user: fromUserId,
        to_user: toUserId,
        amount,
        currency,
        status: 'confirmed',
        method: 'onchain',
        chain_id: chainId,
        token_symbol: token.symbol,
        token_address: token.address,
        tx_hash: txHash,
        from_address: address?.toLowerCase() || null,
        to_address: recipientAddress?.toLowerCase() || null,
      } as any)
      .then(() => push({ kind: 'success', message: 'Settlement recorded on-chain ✓' }))
      .catch((e) => push({ kind: 'error', message: e instanceof Error ? e.message : 'Recording failed' }))
  }, [receipt, recorded, txHash, fromUserId, toUserId, amount, currency, chainId, token, address, recipientAddress, createSettlement, push])

  if (!open) return null

  const handleSend = async () => {
    if (!recipientAddress) {
      push({ kind: 'error', message: 'Recipient has no wallet on file' })
      return
    }
    if (!isAddress(recipientAddress)) {
      push({ kind: 'error', message: 'Invalid recipient address' })
      return
    }
    try {
      if (currentChainId !== chainId) {
        await switchChainAsync({ chainId })
      }

      let hash: `0x${string}`
      if (token.address === null) {
        hash = await sendTransactionAsync({
          to: recipientAddress,
          value: parseEther(amount.toString()),
          chainId,
        })
      } else {
        hash = await writeContractAsync({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipientAddress, parseUnits(amount.toString(), token.decimals)],
          chainId,
        })
      }
      setTxHash(hash)
      push({ kind: 'info', message: 'Transaction submitted' })
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Transaction failed'
      push({ kind: 'error', message: msg })
    }
  }

  const status = receipt
    ? receipt.status === 'success'
      ? 'confirmed'
      : 'failed'
    : txHash
      ? 'pending'
      : 'idle'

  const sending = sendingNative || sendingErc
  const wrongChain = isConnected && currentChainId !== chainId

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settle-title"
      onClick={() => !sending && !confirming && onClose()}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="settle-title" className="font-display text-xl font-bold tracking-tight">Settle on-chain</h2>
            <p className="mt-1 text-xs text-fg-muted">Send crypto directly to {recipientLabel}.</p>
          </div>
          <button
            onClick={onClose}
            disabled={sending || confirming}
            className="text-fg-muted hover:text-fg disabled:opacity-30"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {!recipientAddress ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            <span>{recipientLabel} signed up with email and hasn&rsquo;t linked a wallet. Ask them to sign in with a wallet first, or use &ldquo;Mark paid&rdquo; instead.</span>
          </div>
        ) : !isConnected ? (
          <div className="mt-5 space-y-2">
            <p className="text-sm text-fg-muted">Connect a wallet to send the payment.</p>
            {connectors.map((c) => (
              <button key={c.uid} onClick={() => connect({ connector: c })} className="btn-ghost w-full justify-between">
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4" aria-hidden="true" />{c.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-border-strong bg-bg-elev/40 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-fg-muted">Amount owed</span>
                <span className="tabular font-mono text-2xl font-bold text-neon-lime">
                  {formatCurrency(amount, currency)}
                </span>
              </div>
              <div className="mt-2 text-xs text-fg-dim">
                To <span className="font-mono">{recipientAddress.slice(0, 6)}…{recipientAddress.slice(-4)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="settle-chain" className="mb-1.5 block text-xs text-fg-muted">Network</label>
                <select
                  id="settle-chain"
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value))}
                  disabled={sending || confirming || status === 'confirmed'}
                  className="input-base"
                  style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
                >
                  {SUPPORTED_CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="settle-token" className="mb-1.5 block text-xs text-fg-muted">Token</label>
                <select
                  id="settle-token"
                  value={token.symbol}
                  onChange={(e) => {
                    const found = tokenOptions.find((t) => t.symbol === e.target.value)
                    if (found) setToken(found)
                  }}
                  disabled={sending || confirming || status === 'confirmed'}
                  className="input-base"
                  style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
                >
                  {tokenOptions.map((t) => (
                    <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                  ))}
                </select>
              </div>
            </div>

            {currency !== 'USD' && token.symbol === 'USDC' && (
              <div className="flex items-start gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs text-fg-muted">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                <span>Group currency is {currency}, but you&rsquo;re sending USDC. Make sure the amount is what you intend.</span>
              </div>
            )}

            {wrongChain && (
              <div className="flex items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                <span>Wallet is on {chainName(currentChainId)} — will switch to {chainName(chainId)} on send.</span>
              </div>
            )}

            {status === 'idle' && (
              <button
                onClick={handleSend}
                disabled={sending || switching}
                className="btn-primary w-full"
              >
                {sending || switching ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Sending…</>
                ) : (
                  <>Send {amount} {token.symbol}</>
                )}
              </button>
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

            {status === 'confirmed' && txHash && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-3 py-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>Confirmed on {chainName(chainId)}</span>
                </div>
                <a
                  href={getExplorerTxUrl(chainId, txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-neon-cyan"
                >
                  {txHash.slice(0, 10)}…{txHash.slice(-8)} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
                <button onClick={onClose} className="btn-primary w-full">Done</button>
              </div>
            )}

            {status === 'failed' && (
              <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                <span>Transaction failed. Try again.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}