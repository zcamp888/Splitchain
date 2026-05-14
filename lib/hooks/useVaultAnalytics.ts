'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type MemberContribution = {
  user_id: string | null
  wallet_address: string
  display_name: string
  deposited: number
  claimed: number
  refunded: number
  net: number // deposited - claimed - refunded (negative = received more than put in)
  share_of_pool_pct: number
  share_of_claims_pct: number
  is_me: boolean
}

export type VaultAnalytics = {
  vault_id: string
  vault_name: string
  status: 'active' | 'closed'
  token_symbol: string
  token_decimals: number
  chain_id: number
  total_deposited: number
  total_claimed: number
  total_refunded: number
  remaining_balance: number
  member_count: number
  deposit_count: number
  claim_count: number
  avg_claim_size: number
  largest_claim: number
  efficiency: number // claimed / deposited (how much was actually spent vs refunded)
  duration_days: number | null
  deployed_at: string
  closed_at: string | null
  contributions: MemberContribution[]
  topClaimer: MemberContribution | null
  biggestSpender: MemberContribution | null
}

function profileLabel(p: any, wallet: string): string {
  if (p?.display_name) return p.display_name
  if (p?.email && !p.email.endsWith('@wallet.splitchain.local')) return p.email.split('@')[0]
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
}

export function useVaultAnalytics(vaultId: string | undefined) {
  return useQuery({
    enabled: !!vaultId,
    queryKey: ['vault-analytics', vaultId],
    queryFn: async (): Promise<VaultAnalytics | null> => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const myId = user?.id

      const [
        { data: vault },
        { data: members },
        { data: deposits },
        { data: claims },
        { data: refunds },
      ] = await Promise.all([
        supabase.from('vaults').select('*').eq('id', vaultId).single(),
        supabase
          .from('vault_members')
          .select('user_id, wallet_address, profiles:user_id(id, display_name, email, wallet_address)')
          .eq('vault_id', vaultId),
        supabase.from('vault_deposits').select('*').eq('vault_id', vaultId),
        supabase.from('vault_claims').select('*').eq('vault_id', vaultId),
        supabase.from('vault_refunds').select('*').eq('vault_id', vaultId),
      ])

      if (!vault) return null

      const memberMap = new Map<string, { user_id: string | null; profile: any }>()
      ;(members || []).forEach((m: any) => {
        memberMap.set(m.wallet_address.toLowerCase(), { user_id: m.user_id, profile: m.profiles })
      })

      // Aggregate per wallet
      const perWallet = new Map<string, MemberContribution>()
      const ensureRow = (wallet: string): MemberContribution => {
        const lw = wallet.toLowerCase()
        if (!perWallet.has(lw)) {
          const m = memberMap.get(lw)
          perWallet.set(lw, {
            user_id: m?.user_id || null,
            wallet_address: lw,
            display_name: profileLabel(m?.profile, lw),
            deposited: 0,
            claimed: 0,
            refunded: 0,
            net: 0,
            share_of_pool_pct: 0,
            share_of_claims_pct: 0,
            is_me: m?.user_id === myId,
          })
        }
        return perWallet.get(lw)!
      }

      // Ensure every member appears even with zero activity
      ;(members || []).forEach((m: any) => ensureRow(m.wallet_address))

      ;(deposits || []).forEach((d: any) => {
        const row = ensureRow(d.member_address)
        row.deposited += Number(d.amount)
      })
      ;(claims || []).forEach((c: any) => {
        const row = ensureRow(c.claimer_address)
        row.claimed += Number(c.amount)
      })
      ;(refunds || []).forEach((r: any) => {
        const row = ensureRow(r.member_address)
        row.refunded += Number(r.amount)
      })

      const totalDep = Number(vault.total_deposited)
      const totalClaim = Number(vault.total_claimed)
      const totalRefund = (refunds || []).reduce((s: number, r: any) => s + Number(r.amount), 0)

      const contributions: MemberContribution[] = Array.from(perWallet.values()).map((c) => ({
        ...c,
        net: c.deposited - c.claimed - c.refunded,
        share_of_pool_pct: totalDep > 0 ? (c.deposited / totalDep) * 100 : 0,
        share_of_claims_pct: totalClaim > 0 ? (c.claimed / totalClaim) * 100 : 0,
      })).sort((a, b) => b.deposited - a.deposited)

      const topClaimer = contributions.length > 0
        ? [...contributions].sort((a, b) => b.claimed - a.claimed)[0] || null
        : null
      const biggestSpender = topClaimer && topClaimer.claimed > 0 ? topClaimer : null

      const claimAmounts = (claims || []).map((c: any) => Number(c.amount))
      const avgClaim = claimAmounts.length > 0
        ? claimAmounts.reduce((s, a) => s + a, 0) / claimAmounts.length
        : 0
      const largestClaim = claimAmounts.length > 0 ? Math.max(...claimAmounts) : 0

      const deployedAt = new Date(vault.deployed_at)
      const endAt = vault.closed_at ? new Date(vault.closed_at) : new Date()
      const durationDays = vault.closed_at
        ? Math.max(1, Math.round((endAt.getTime() - deployedAt.getTime()) / (1000 * 60 * 60 * 24)))
        : null

      return {
        vault_id: vault.id,
        vault_name: vault.name,
        status: vault.status,
        token_symbol: vault.token_symbol,
        token_decimals: vault.token_decimals,
        chain_id: vault.chain_id,
        total_deposited: totalDep,
        total_claimed: totalClaim,
        total_refunded: totalRefund,
        remaining_balance: Number(vault.remaining_balance),
        member_count: (members || []).length,
        deposit_count: (deposits || []).length,
        claim_count: (claims || []).length,
        avg_claim_size: avgClaim,
        largest_claim: largestClaim,
        efficiency: totalDep > 0 ? (totalClaim / totalDep) * 100 : 0,
        duration_days: durationDays,
        deployed_at: vault.deployed_at,
        closed_at: vault.closed_at,
        contributions,
        topClaimer,
        biggestSpender,
      }
    },
  })
}