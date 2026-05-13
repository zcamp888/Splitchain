'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, AlertCircle, Wallet, Sparkles, CheckCircle2, ExternalLink } from 'lucide-react'
import {
  useAccount,
  useConnect,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi'
import { parseUnits, getAddress, decodeEventLog } from 'viem'
import { FACTORY_ABI } from '@/lib/vaults/abi'
import { getFactoryAddress, VAULT_SUPPORTED_CHAINS, VAULT_USDC, getDefaultVaultChainId } from '@/lib/vaults/config'
import { uuidToBytes32 } from '@/lib/vaults/utils'
import { chainName, getExplorerTxUrl } from '@/lib/chains'
import { useRegisterVault } from '@/lib/hooks/useVaults'
import { useToast } from '@/components/Toaster'
import { formatCurrency } from '@/lib/balances'

export function CreateVaultDialog({
  open,
  onClose,
  groupId,
  groupName,
  members,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  groupName: string
  members: any[]
}) {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const publicClient = usePublicClient()

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [chainId, setChainId] = useState(getDefaultVaultChainId())
  const [step, setStep] = useState<'form' | 'pending' | 'done'>('form')

  const { writeContractAsync, isPending: writing } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const { data: receipt, isLoading: confirming } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
    chainId,
  })
  const [vaultAddress, setVaultAddress] = useState<string | null>(null)

  const register = useRegisterVault()
  const { push } = useToast()

  const factoryAddress = getFactoryAddress(chainId)
  const usdc = VAULT_USDC[chainId]

  useEffect(() => {
    if (!open) return
    setName(`${groupName} vault`)
    setTarget('')
    setChainId(getDefaultVaultChainId())
    setStep('form')
    setTxHash(null)
    setVaultAddress(null)
  }, [open, groupName])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'pending') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, step])

  // Members with wallet addresses (required for the contract)
  const eligibleMembers = useMemo(
    () => members.filter((m: any) => m.profile?.wallet_address),
    [members]
  )
  const missingWalletCount = members.length - eligibleMembers.length

  const numericTarget = useMemo(() => {
    const n = parseFloat(target)
    return isNaN(n) ? 0 : n
  }, [target])

  // Watch receipt → extract vault address → register in DB
  useEffect(() => {
    if (!receipt || !txHash || vaultAddress) return
    if (receipt.status !== 'success') {
      push({ kind: 'error', message: 'Transaction reverted on-chain' })
      setStep('form')
      return
    }

    try {
      // Find the VaultCreated event in the logs
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'VaultCreated') {
            const args: any = decoded.args
            const vault = args.vault as string
            setVaultAddress(vault)

            // Persist to DB
            register
              .mutateAsync({
                group_id: groupId,
                contract_address: vault,
                chain_id: chainId,
                token_address: usdc.address,
                token_symbol: usdc.symbol,
                token_decimals: usdc.decimals,
                target_per_member: numericTarget,
                name: name.trim(),
                owner_address: address || '',
                deploy_tx_hash: txHash,
                members: eligibleMembers.map((m: any) => ({
                  user_id: m.user_id,
                  wallet_address: m.profile.wallet_address,
                })),
              })
              .then(() => {
                setStep('done')
                push({ kind: 'success', message: 'Vault deployed ✓' })
              })
              .catch((e) => {
                push({ kind: 'error', message: `Vault deployed but DB sync failed: ${e.message}` })
                setStep('done')
              })
            return
          }
        } catch {
          // Not the event we care about — skip
        }
      }
      push({ kind: 'error', message: 'VaultCreated event not found in receipt' })
      setStep('form')
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to parse receipt' })
      setStep('form')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, txHash])

  if (!open) return null

  const handleDeploy = async () => {
    try {
      if (!factoryAddress) throw new Error('Factory not deployed on this network yet')
      if (!isConnected || !address) throw new Error('Connect wallet first')
      if (eligibleMembers.length === 0) throw new Error('No members have linked wallets')
      if (numericTarget <= 0) throw new Error('Target must be greater than 0')
      if (!name.trim()) throw new Error('Name required')

      if (currentChainId !== chainId) {
        await switchChainAsync({ chainId })
      }

      setStep('pending')

      const memberAddresses = eligibleMembers.map((m: any) =>
        getAddress(m.profile.wallet_address)
      )
      const groupIdHash = uuidToBytes32(groupId)
      const targetWei = parseUnits(target, usdc.decimals)

      const hash = await writeContractAsync({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: 'createVault',
        args: [groupIdHash, usdc.address, targetWei, memberAddresses],
        chainId,
      })
      setTxHash(hash)
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Deploy failed'
      push({ kind: 'error', message: msg })
      setStep('form')
    }
  }

  const wrongChain = isConnected && currentChainId !== chainId
  const busy = writing || switching || confirming
  const totalTarget = numericTarget * eligibleMembers.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-vault-title"
      onClick={() => step !== 'pending' && onClose()}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="create-vault-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <Sparkles className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
              Create vault
            </h2>
            <p className="mt-1 text-xs text-fg-muted">Pool USDC upfront; reimburse during the trip.</p>
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
              <span>Vault deployed and ready for deposits.</span>
            </div>
            {vaultAddress && (
              <div className="rounded-xl border border-border-strong bg-bg-elev/60 p-3 text-xs">
                <div className="text-fg-dim">Contract address</div>
                <div className="mt-1 break-all font-mono">{vaultAddress}</div>
              </div>
            )}
            {txHash && (
              <a
                href={getExplorerTxUrl(chainId, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-neon-cyan"
              >
                View deploy tx <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <>
            {!factoryAddress && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
                <span>
                  No vault factory deployed on {chainName(chainId)} yet. See <code className="font-mono">contracts/DEPLOY.md</code>.
                </span>
              </div>
            )}

            {missingWalletCount > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                <span>
                  {missingWalletCount} member{missingWalletCount === 1 ? '' : 's'} signed up with email and can&rsquo;t deposit. Only the {eligibleMembers.length} with wallets will be added.
                </span>
              </div>
            )}

            {!isConnected ? (
              <div className="mt-5 space-y-2">
                <p className="text-sm text-fg-muted">Connect a wallet to deploy the vault.</p>
                {connectors.map((c) => (
                  <button key={c.uid} onClick={() => connect({ connector: c })} className="btn-ghost w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" aria-hidden="true" />
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="vault-name" className="mb-1.5 block text-xs text-fg-muted">Vault name</label>
                  <input
                    id="vault-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={80}
                    disabled={busy}
                    placeholder="Ski trip 2025"
                    autoComplete="off"
                    className="input-base"
                  />
                </div>

                <div>
                  <label htmlFor="vault-chain" className="mb-1.5 block text-xs text-fg-muted">Network</label>
                  <select
                    id="vault-chain"
                    value={chainId}
                    onChange={(e) => setChainId(Number(e.target.value))}
                    disabled={busy}
                    className="input-base"
                    style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
                  >
                    {VAULT_SUPPORTED_CHAINS.map((c) => {
                      const available = !!getFactoryAddress(c.id)
                      return (
                        <option key={c.id} value={c.id} disabled={!available}>
                          {c.name}{available ? '' : ' (not deployed)'}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label htmlFor="vault-target" className="mb-1.5 block text-xs text-fg-muted">
                    Target deposit per member (USDC)
                  </label>
                  <input
                    id="vault-target"
                    type="number"
                    step="0.01"
                    min="1"
                    inputMode="decimal"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    required
                    disabled={busy}
                    placeholder="400.00"
                    className="input-base tabular font-mono"
                  />
                  {numericTarget > 0 && eligibleMembers.length > 0 && (
                    <p className="mt-1.5 text-xs text-fg-dim">
                      {eligibleMembers.length} × {formatCurrency(numericTarget, 'USD')} = pool target{' '}
                      <span className="font-mono text-neon-lime">{formatCurrency(totalTarget, 'USD')}</span>
                    </p>
                  )}
                </div>

                {wrongChain && (
                  <div className="flex items-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                    <span>Wallet is on {chainName(currentChainId)} — will switch to {chainName(chainId)}.</span>
                  </div>
                )}

                {step === 'pending' && txHash && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2.5 text-sm">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neon-cyan" aria-hidden="true" />
                      <span>Deploying vault…</span>
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

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={busy || !factoryAddress || eligibleMembers.length === 0 || !numericTarget || !name.trim()}
                    className="btn-primary"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Deploying…
                      </>
                    ) : (
                      'Deploy vault'
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}