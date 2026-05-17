'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, ExternalLink, AlertCircle, CheckCircle2, Wallet, Search, ChevronDown, UserPlus, Check } from 'lucide-react'
import {
  useAccount,
  useConnect,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi'
import { parseUnits, isAddress, getAddress } from 'viem'
import { SUPPORTED_CHAINS, getExplorerTxUrl, chainName } from '@/lib/chains'
import { USDC_BY_CHAIN, ERC20_ABI } from '@/lib/tokens'
import { useCreateSettlement } from '@/lib/hooks'
import { displayName } from '@/lib/displayName'
import { useToast } from '@/components/Toaster'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'

type GroupMember = {
  user_id: string
  profile: {
    id?: string | null
    nickname?: string | null
    display_name?: string | null
    email?: string | null
    wallet_address?: string | null
  } | null
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// Deterministic gradient avatar per wallet
function avatarGradient(seed: string): string {
  const colors = [
    'from-neon-violet to-neon-cyan',
    'from-neon-cyan to-neon-lime',
    'from-neon-lime to-neon-violet',
    'from-pink-500 to-neon-violet',
    'from-amber-500 to-pink-500',
    'from-neon-cyan to-blue-500',
    'from-emerald-500 to-neon-cyan',
    'from-fuchsia-500 to-neon-violet',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return colors[Math.abs(hash) % colors.length]
}

function initials(label: string): string {
  const cleaned = label.replace(/[…0x]/g, '').trim()
  if (!cleaned) return '?'
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

function MemberAvatar({ wallet, label }: { wallet: string; label: string }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(wallet || label)} text-bg font-display text-sm font-bold shadow-sm`}
      aria-hidden="true"
    >
      {initials(label)}
    </div>
  )
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
  groupMembers?: GroupMember[]
  currentUserId: string | null
}) {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: switching } = useSwitchChain()

  const [chainId, setChainId] = useState<number>(SUPPORTED_CHAINS[0].id)
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [recipientInput, setRecipientInput] = useState('')
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null)
  const [resolvedEns, setResolvedEns] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [amount, setAmount] = useState('')
  const [search, setSearch] = useState('')

  const { writeContractAsync, isPending: writing } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const { data: receipt, isLoading: confirming } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
    chainId,
  })

  const createSettlement = useCreateSettlement(groupId || '')
  const { push } = useToast()
  const [recorded, setRecorded] = useState(false)

  useBodyScrollLock(open)

  const usdc = USDC_BY_CHAIN[chainId]

  // Read wallet's USDC balance
  const { data: walletBalance } = useReadContract({
    address: usdc?.address as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address && isConnected && !!usdc },
  })

  const walletBalanceFormatted = walletBalance && usdc
    ? Number(walletBalance) / 10 ** usdc.decimals
    : 0

  // Eligible members (excluding self, must have wallet)
  const eligibleMembers = useMemo(() => {
    if (!groupMembers) return []
    return groupMembers
      .filter((m) => m.user_id !== currentUserId)
      .filter((m) => m.profile?.wallet_address)
  }, [groupMembers, currentUserId])

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return eligibleMembers
    const q = search.toLowerCase()
    return eligibleMembers.filter((m) => {
      const label = displayName(m.profile).toLowerCase()
      const wallet = (m.profile?.wallet_address || '').toLowerCase()
      return label.includes(q) || wallet.includes(q)
    })
  }, [eligibleMembers, search])

  const hasGroupContext = eligibleMembers.length > 0
  const showSearch = eligibleMembers.length >= 5

  useEffect(() => {
    if (!open) return
    setTxHash(null)
    setRecorded(false)
    setChainId(SUPPORTED_CHAINS[0].id)
    setSelectedMember(null)
    setManualMode(!hasGroupContext)
    setRecipientInput('')
    setResolvedAddress(null)
    setResolvedEns(null)
    setAmount('')
    setSearch('')
  }, [open, hasGroupContext])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !writing && !confirming) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, writing, confirming])

  // Resolve recipient input (address or ENS) — only when in manual mode
  useEffect(() => {
    if (!manualMode || !recipientInput.trim()) {
      setResolvedAddress(null)
      setResolvedEns(null)
      return
    }
    const input = recipientInput.trim()

    if (isAddress(input)) {
      setResolvedAddress(getAddress(input))
      setResolvedEns(null)
      return
    }

    if (input.includes('.')) {
      const handle = setTimeout(async () => {
        setResolving(true)
        try {
          const res = await fetch('/api/ens/resolve', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ input }),
          })
          const json = await res.json()
          if (res.ok && json.address) {
            setResolvedAddress(json.address)
            setResolvedEns(json.ens || null)
          } else {
            setResolvedAddress(null)
            setResolvedEns(null)
          }
        } catch {
          setResolvedAddress(null)
        } finally {
          setResolving(false)
        }
      }, 400)
      return () => clearTimeout(handle)
    }

    setResolvedAddress(null)
    setResolvedEns(null)
  }, [recipientInput, manualMode])

  // Final recipient address — from selected member or manual input
  const finalRecipient = useMemo(() => {
    if (selectedMember?.profile?.wallet_address) {
      return getAddress(selectedMember.profile.wallet_address)
    }
    return resolvedAddress
  }, [selectedMember, resolvedAddress])

  const finalRecipientLabel = useMemo(() => {
    if (selectedMember) return displayName(selectedMember.profile)
    if (resolvedEns) return resolvedEns
    if (resolvedAddress) return shortAddr(resolvedAddress)
    return ''
  }, [selectedMember, resolvedEns, resolvedAddress])

  // Auto-record settlement when paying a group member
  useEffect(() => {
    if (!receipt || recorded || !txHash || !groupId) return
    if (receipt.status !== 'success') return
    if (!selectedMember) return // only record when paying a known group member
    if (!currentUserId) return

    setRecorded(true)
    createSettlement
      .mutateAsync({
        from_user: currentUserId,
        to_user: selectedMember.user_id,
        amount: parseFloat(amount),
        currency: 'USD',
        status: 'confirmed',
        method: 'onchain',
        chain_id: chainId,
        token_symbol: usdc.symbol,
        token_address: usdc.address,
        tx_hash: txHash,
        from_address: address?.toLowerCase() || null,
        to_address: finalRecipient?.toLowerCase() || null,
      } as any)
      .then(() => push({ kind: 'success', message: 'Recorded as settlement' }))
      .catch(() => {
        // tx already on-chain, just no settlement record
      })
  }, [receipt, recorded, txHash, selectedMember, currentUserId, amount, chainId, usdc, address, finalRecipient, createSettlement, push, groupId])

  if (!open) return null

  const handleSelectMember = (m: GroupMember) => {
    setSelectedMember(m)
    setManualMode(false)
    setRecipientInput('')
    setResolvedAddress(null)
    setResolvedEns(null)
  }

  const handleChangeRecipient = () => {
    setSelectedMember(null)
    setManualMode(false)
    setRecipientInput('')
  }

  const handleMaxBalance = () => {
    if (walletBalanceFormatted > 0) {
      setAmount(walletBalanceFormatted.toFixed(2))
    }
  }

  const handleSend = async () => {
    if (!finalRecipient) {
      push({ kind: 'error', message: 'Choose a recipient' })
      return
    }
    if (!usdc) {
      push({ kind: 'error', message: 'USDC not available on this chain' })
      return
    }
    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      push({ kind: 'error', message: 'Enter a valid amount' })
      return
    }
    if (numericAmount > walletBalanceFormatted) {
      push({ kind: 'error', message: 'Insufficient USDC balance' })
      return
    }

    try {
      if (currentChainId !== chainId) {
        await switchChainAsync({ chainId })
      }

      const hash = await writeContractAsync({
        address: usdc.address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [finalRecipient as `0x${string}`, parseUnits(amount, usdc.decimals)],
        chainId,
      })
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

  const sending = writing
  const wrongChain = isConnected && currentChainId !== chainId
  const numericAmount = parseFloat(amount) || 0
  const insufficientBalance = numericAmount > walletBalanceFormatted

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-usdc-title"
      onClick={() => !sending && !confirming && onClose()}
    >
      <div className="sheet-container" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="sheet-header">
          <div className="min-w-0">
            <h2 id="send-usdc-title" className="font-display text-lg font-bold tracking-tight sm:text-xl">
              Send USDC
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              {hasGroupContext ? 'Pick a member or send anywhere.' : 'Send to any wallet or ENS name.'}
            </p>
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

        {!isConnected ? (
          <div className="flex-1 space-y-2 px-5 py-5">
            <p className="mb-2 text-sm text-fg-muted">Connect a wallet to send USDC.</p>
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
          <div className="flex-1 space-y-4 px-5 py-5">
            <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-display font-semibold">Sent ✓</div>
                <div className="text-xs text-fg-muted">
                  {amount} USDC to {finalRecipientLabel} on {chainName(chainId)}
                </div>
              </div>
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
        ) : (
          <div className="flex-1 space-y-5 px-5 py-5">
            {/* Recipient section */}
            {selectedMember || (manualMode && resolvedAddress) ? (
              <div className="rounded-2xl border border-neon-violet/30 bg-gradient-to-br from-neon-violet/5 to-neon-cyan/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-fg-muted">Sending to</span>
                  <button
                    onClick={handleChangeRecipient}
                    disabled={sending || confirming || status === 'pending'}
                    className="text-xs font-medium text-neon-cyan hover:underline disabled:opacity-30"
                  >
                    Change
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {finalRecipient && <MemberAvatar wallet={finalRecipient} label={finalRecipientLabel} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-semibold">{finalRecipientLabel}</div>
                    {finalRecipient && (
                      <div className="mt-0.5 truncate font-mono text-[10px] text-fg-dim">
                        {finalRecipient}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : !manualMode && hasGroupContext ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider text-fg-muted">Group members</label>
                  <span className="text-[10px] text-fg-dim">
                    {eligibleMembers.length} with wallet
                  </span>
                </div>

                {showSearch && (
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-dim" aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search members…"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Search members"
                      className="input-base pl-10"
                    />
                  </div>
                )}

                <ul
                  role="listbox"
                  aria-label="Group members"
                  className="scroll-y max-h-[40vh] space-y-1.5 overflow-y-auto rounded-2xl border border-border-strong bg-bg-elev/40 p-2 sm:max-h-72"
                >
                  {filteredMembers.length === 0 ? (
                    <li className="px-3 py-6 text-center text-xs text-fg-dim">
                      No members match &ldquo;{search}&rdquo;
                    </li>
                  ) : (
                    filteredMembers.map((m) => {
                      const label = displayName(m.profile)
                      const wallet = m.profile!.wallet_address!
                      return (
                        <li key={m.user_id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected="false"
                            onClick={() => handleSelectMember(m)}
                            className="group flex w-full items-center gap-3 rounded-xl bg-bg-card/40 px-3 py-2.5 text-left transition-colors active:scale-[0.98] hover:bg-bg-card hover:ring-2 hover:ring-neon-violet/40"
                          >
                            <MemberAvatar wallet={wallet} label={label} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{label}</div>
                              <div className="truncate font-mono text-[10px] text-fg-dim">
                                {shortAddr(wallet)}
                              </div>
                            </div>
                            <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-fg-dim transition-colors group-hover:text-neon-cyan" aria-hidden="true" />
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>

                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="mt-3 flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-bg-elev/30 px-3 text-xs text-fg-muted transition-colors hover:border-neon-cyan/40 hover:text-fg"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Send to someone outside the group
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="recipient" className="text-xs text-fg-muted">
                    Recipient (wallet or ENS)
                  </label>
                  {hasGroupContext && (
                    <button
                      type="button"
                      onClick={() => { setManualMode(false); setRecipientInput('') }}
                      className="text-xs font-medium text-neon-cyan hover:underline"
                    >
                      ← Pick from group
                    </button>
                  )}
                </div>
                <input
                  id="recipient"
                  name="recipient"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="vitalik.eth or 0x…"
                  autoComplete="off"
                  spellCheck={false}
                  className="input-base font-mono text-sm"
                />
                {resolving && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-muted">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    Resolving…
                  </div>
                )}
                {recipientInput && !resolving && !resolvedAddress && recipientInput.length > 3 && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-danger">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    Not a valid address or ENS name
                  </p>
                )}
              </div>
            )}

            {/* Chain selector */}
            <div>
              <label htmlFor="send-chain" className="mb-1.5 block text-xs text-fg-muted">Network</label>
              <select
                id="send-chain"
                value={chainId}
                onChange={(e) => setChainId(Number(e.target.value))}
                disabled={sending || confirming || status === 'pending'}
                className="input-base"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                {SUPPORTED_CHAINS.filter((c) => USDC_BY_CHAIN[c.id]).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="send-amount" className="text-xs text-fg-muted">Amount (USDC)</label>
                <button
                  type="button"
                  onClick={handleMaxBalance}
                  disabled={walletBalanceFormatted <= 0}
                  className="text-xs font-medium text-neon-cyan hover:underline disabled:opacity-30"
                >
                  Max: {walletBalanceFormatted.toFixed(2)}
                </button>
              </div>
              <input
                id="send-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={sending || confirming || status === 'pending'}
                className="input-base tabular font-mono text-lg sm:text-base"
              />
              {insufficientBalance && numericAmount > 0 && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-danger">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  Insufficient USDC balance
                </p>
              )}
            </div>

            {wrongChain && (
              <div className="flex items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                <span>Wallet is on {chainName(currentChainId)} — will switch to {chainName(chainId)} on send.</span>
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
          </div>
        )}

        {isConnected && status !== 'confirmed' && (
          <div className="sheet-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={sending || confirming || status === 'pending'}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={
                sending ||
                switching ||
                confirming ||
                status === 'pending' ||
                !finalRecipient ||
                !numericAmount ||
                insufficientBalance
              }
              className="btn-primary flex-1"
            >
              {sending || switching || status === 'pending' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Send {numericAmount > 0 ? numericAmount.toFixed(2) : ''} USDC
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}