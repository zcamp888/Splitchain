'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type Badge = {
  id: string
  label: string
  description: string
  icon: 'crown' | 'flame' | 'rocket' | 'gem' | 'trophy' | 'sparkles' | 'zap' | 'compass'
  earned: boolean
  progress?: { current: number; target: number }
}

export type GroupSummary = {
  group_id: string
  name: string
  emoji: string
  currency: string
  member_count: number
  expense_count: number
  total_spent: number
  my_share: number
  i_paid_count: number
  first_activity: string
  last_activity: string
  days_active: number
}

export type VaultSummary = {
  vault_id: string
  name: string
  group_name: string
  group_emoji: string
  status: 'active' | 'closed'
  chain_id: number
  total_pooled: number
  my_deposited: number
  my_claimed: number
  my_refunded: number
  duration_days: number | null
  closed_at: string | null
  is_biggest_spender: boolean
}

export type LifetimeStats = {
  // Headline numbers
  total_groups: number
  active_groups: number
  total_expenses: number
  total_spent_across_groups: Record<string, number> // by currency
  my_share_across_groups: Record<string, number>
  i_paid_count: number

  // Vault metrics (USDC, single currency)
  total_vaults: number
  closed_vaults: number
  total_pooled_usdc: number
  total_deposited_usdc: number
  total_claimed_usdc: number
  total_refunded_usdc: number
  biggest_spender_titles: number

  // Streaks + records
  longest_group: GroupSummary | null
  biggest_group: GroupSummary | null
  most_active_group: GroupSummary | null
  oldest_member_since: string | null
  current_streak_days: number

  // Detailed breakdowns
  groups: GroupSummary[]
  vaults: VaultSummary[]
  badges: Badge[]

  // Time series — expenses per month (last 12)
  monthly_activity: { month: string; count: number; total: number }[]
}

function profileMatches(p: any, userId: string): boolean {
  return p?.id === userId
}

export function useLifetimeStats() {
  return useQuery({
    queryKey: ['lifetime-stats'],
    queryFn: async (): Promise<LifetimeStats> => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      const empty: LifetimeStats = {
        total_groups: 0,
        active_groups: 0,
        total_expenses: 0,
        total_spent_across_groups: {},
        my_share_across_groups: {},
        i_paid_count: 0,
        total_vaults: 0,
        closed_vaults: 0,
        total_pooled_usdc: 0,
        total_deposited_usdc: 0,
        total_claimed_usdc: 0,
        total_refunded_usdc: 0,
        biggest_spender_titles: 0,
        longest_group: null,
        biggest_group: null,
        most_active_group: null,
        oldest_member_since: null,
        current_streak_days: 0,
        groups: [],
        vaults: [],
        badges: [],
        monthly_activity: [],
      }
      if (!user) return empty

      // 1. Profile — earliest membership timestamp
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id, joined_at, groups:group_id(id, name, cover_emoji, currency)')
        .eq('user_id', user.id)

      const groupIds = (memberships || []).map((m: any) => m.group_id)
      if (groupIds.length === 0) return empty

      const oldestMemberSince = (memberships || []).reduce<string | null>((earliest, m: any) => {
        if (!earliest || m.joined_at < earliest) return m.joined_at
        return earliest
      }, null)

      // 2. All expenses across my groups
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, group_id, paid_by, amount, currency, expense_date, created_at, splits:expense_splits(user_id, share_amount)')
        .in('group_id', groupIds)

      // 3. All member counts per group
      const { data: allMembers } = await supabase
        .from('group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds)

      const membersByGroup = new Map<string, number>()
      ;(allMembers || []).forEach((m: any) => {
        membersByGroup.set(m.group_id, (membersByGroup.get(m.group_id) || 0) + 1)
      })

      // 4. All vaults across my groups
      const { data: vaultsRaw } = await supabase
        .from('vaults')
        .select('*, vault_members(user_id, wallet_address)')
        .in('group_id', groupIds)

      const vaultIds = (vaultsRaw || []).map((v: any) => v.id)

      // 5. Vault deposits, claims, refunds — only for vaults where I'm a member
      const myVaultIds = (vaultsRaw || [])
        .filter((v: any) => (v.vault_members || []).some((vm: any) => vm.user_id === user.id))
        .map((v: any) => v.id)

      const [{ data: myDeposits }, { data: myClaims }, { data: myRefunds }, { data: allClaims }] = await Promise.all([
        myVaultIds.length > 0
          ? supabase.from('vault_deposits').select('vault_id, amount').in('vault_id', myVaultIds).eq('member_user_id', user.id)
          : Promise.resolve({ data: [] }),
        myVaultIds.length > 0
          ? supabase.from('vault_claims').select('vault_id, amount').in('vault_id', myVaultIds).eq('claimer_user_id', user.id)
          : Promise.resolve({ data: [] }),
        myVaultIds.length > 0
          ? supabase.from('vault_refunds').select('vault_id, amount').in('vault_id', myVaultIds).eq('member_user_id', user.id)
          : Promise.resolve({ data: [] }),
        vaultIds.length > 0
          ? supabase.from('vault_claims').select('vault_id, claimer_user_id, amount').in('vault_id', vaultIds)
          : Promise.resolve({ data: [] }),
      ])

      // ---- Compute per-group summaries ----
      const groupMap = new Map<string, any>()
      ;(memberships || []).forEach((m: any) => groupMap.set(m.group_id, m.groups))

      const groupSummaries = new Map<string, GroupSummary>()
      ;(memberships || []).forEach((m: any) => {
        const g = m.groups
        if (!g) return
        groupSummaries.set(g.id, {
          group_id: g.id,
          name: g.name,
          emoji: g.cover_emoji,
          currency: g.currency,
          member_count: membersByGroup.get(g.id) || 0,
          expense_count: 0,
          total_spent: 0,
          my_share: 0,
          i_paid_count: 0,
          first_activity: m.joined_at,
          last_activity: m.joined_at,
          days_active: 0,
        })
      })

      let totalExpenses = 0
      let iPaidCount = 0
      const spentByCurrency: Record<string, number> = {}
      const myShareByCurrency: Record<string, number> = {}

      ;(expenses || []).forEach((e: any) => {
        totalExpenses++
        const amount = Number(e.amount)
        const currency = e.currency || 'USD'
        spentByCurrency[currency] = (spentByCurrency[currency] || 0) + amount

        const mySplit = (e.splits || []).find((s: any) => s.user_id === user.id)
        const myAmt = mySplit ? Number(mySplit.share_amount) : 0
        myShareByCurrency[currency] = (myShareByCurrency[currency] || 0) + myAmt

        if (e.paid_by === user.id) iPaidCount++

        const summary = groupSummaries.get(e.group_id)
        if (summary) {
          summary.expense_count++
          summary.total_spent += amount
          summary.my_share += myAmt
          if (e.paid_by === user.id) summary.i_paid_count++
          if (e.created_at > summary.last_activity) summary.last_activity = e.created_at
          if (e.created_at < summary.first_activity) summary.first_activity = e.created_at
        }
      })

      // Compute days_active per group
      groupSummaries.forEach((s) => {
        const start = new Date(s.first_activity).getTime()
        const end = new Date(s.last_activity).getTime()
        s.days_active = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
      })

      const groups = Array.from(groupSummaries.values()).sort((a, b) => b.total_spent - a.total_spent)

      // ---- Compute per-vault summaries ----
      // Tally claims per vault to find biggest spender per vault
      const claimsByVault = new Map<string, Map<string, number>>()
      ;(allClaims || []).forEach((c: any) => {
        if (!c.claimer_user_id) return
        if (!claimsByVault.has(c.vault_id)) claimsByVault.set(c.vault_id, new Map())
        const m = claimsByVault.get(c.vault_id)!
        m.set(c.claimer_user_id, (m.get(c.claimer_user_id) || 0) + Number(c.amount))
      })

      const myDepositsByVault = new Map<string, number>()
      ;(myDeposits || []).forEach((d: any) => {
        myDepositsByVault.set(d.vault_id, (myDepositsByVault.get(d.vault_id) || 0) + Number(d.amount))
      })
      const myClaimsByVault = new Map<string, number>()
      ;(myClaims || []).forEach((c: any) => {
        myClaimsByVault.set(c.vault_id, (myClaimsByVault.get(c.vault_id) || 0) + Number(c.amount))
      })
      const myRefundsByVault = new Map<string, number>()
      ;(myRefunds || []).forEach((r: any) => {
        myRefundsByVault.set(r.vault_id, (myRefundsByVault.get(r.vault_id) || 0) + Number(r.amount))
      })

      let biggestSpenderTitles = 0
      const vaults: VaultSummary[] = (vaultsRaw || [])
        .filter((v: any) => (v.vault_members || []).some((vm: any) => vm.user_id === user.id))
        .map((v: any) => {
          const claimMap = claimsByVault.get(v.id) || new Map()
          const topClaimer = Array.from(claimMap.entries()).sort((a, b) => b[1] - a[1])[0]
          const isBiggest = !!(topClaimer && topClaimer[0] === user.id && topClaimer[1] > 0)
          if (isBiggest) biggestSpenderTitles++

          const deployedAt = new Date(v.deployed_at)
          const endAt = v.closed_at ? new Date(v.closed_at) : new Date()
          const duration = v.closed_at
            ? Math.max(1, Math.round((endAt.getTime() - deployedAt.getTime()) / (1000 * 60 * 60 * 24)))
            : null

          const g = groupMap.get(v.group_id)

          return {
            vault_id: v.id,
            name: v.name,
            group_name: g?.name || 'Group',
            group_emoji: g?.cover_emoji || '💸',
            status: v.status,
            chain_id: v.chain_id,
            total_pooled: Number(v.total_deposited),
            my_deposited: myDepositsByVault.get(v.id) || 0,
            my_claimed: myClaimsByVault.get(v.id) || 0,
            my_refunded: myRefundsByVault.get(v.id) || 0,
            duration_days: duration,
            closed_at: v.closed_at,
            is_biggest_spender: isBiggest,
          }
        })
        .sort((a, b) => b.total_pooled - a.total_pooled)

      const totalPooledUsdc = vaults.reduce((s, v) => s + v.total_pooled, 0)
      const totalDepositedUsdc = vaults.reduce((s, v) => s + v.my_deposited, 0)
      const totalClaimedUsdc = vaults.reduce((s, v) => s + v.my_claimed, 0)
      const totalRefundedUsdc = vaults.reduce((s, v) => s + v.my_refunded, 0)
      const closedVaults = vaults.filter((v) => v.status === 'closed').length

      // ---- Records ----
      const longestGroup = groups.length > 0
        ? [...groups].sort((a, b) => b.days_active - a.days_active)[0]
        : null
      const biggestGroup = groups.length > 0
        ? [...groups].sort((a, b) => b.member_count - a.member_count)[0]
        : null
      const mostActiveGroup = groups.length > 0
        ? [...groups].sort((a, b) => b.expense_count - a.expense_count)[0]
        : null

      // ---- Streak: consecutive days with at least one expense in last 30 ----
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const activeDays = new Set<string>()
      ;(expenses || []).forEach((e: any) => {
        const d = new Date(e.created_at)
        d.setHours(0, 0, 0, 0)
        activeDays.add(d.toISOString().slice(0, 10))
      })
      let streak = 0
      for (let i = 0; i < 60; i++) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        if (activeDays.has(key)) {
          streak++
        } else if (i > 0) {
          break
        }
      }

      // ---- Monthly activity (last 12 months) ----
      const monthMap = new Map<string, { count: number; total: number }>()
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthMap.set(key, { count: 0, total: 0 })
      }
      ;(expenses || []).forEach((e: any) => {
        const key = e.expense_date.slice(0, 7)
        if (monthMap.has(key)) {
          const v = monthMap.get(key)!
          v.count++
          // Sum my share only — own perspective
          const mySplit = (e.splits || []).find((s: any) => s.user_id === user.id)
          v.total += mySplit ? Number(mySplit.share_amount) : 0
        }
      })
      const monthlyActivity = Array.from(monthMap.entries()).map(([month, v]) => ({
        month,
        count: v.count,
        total: Math.round(v.total * 100) / 100,
      }))

      // ---- Badges ----
      const totalSpentUSD = spentByCurrency['USD'] || 0
      const myShareUSD = myShareByCurrency['USD'] || 0
      const memberSinceDays = oldestMemberSince
        ? Math.floor((Date.now() - new Date(oldestMemberSince).getTime()) / (1000 * 60 * 60 * 24))
        : 0

      const badges: Badge[] = [
        {
          id: 'first_steps',
          label: 'First steps',
          description: 'Joined SplitChain',
          icon: 'sparkles',
          earned: true,
        },
        {
          id: 'group_starter',
          label: 'Group starter',
          description: 'Joined 3+ groups',
          icon: 'compass',
          earned: groups.length >= 3,
          progress: { current: Math.min(groups.length, 3), target: 3 },
        },
        {
          id: 'frequent_payer',
          label: 'Frequent payer',
          description: 'Paid for 10+ expenses',
          icon: 'flame',
          earned: iPaidCount >= 10,
          progress: { current: Math.min(iPaidCount, 10), target: 10 },
        },
        {
          id: 'centurion',
          label: 'Centurion',
          description: 'Tracked 100+ expenses',
          icon: 'rocket',
          earned: totalExpenses >= 100,
          progress: { current: Math.min(totalExpenses, 100), target: 100 },
        },
        {
          id: 'vault_pioneer',
          label: 'Vault pioneer',
          description: 'Deposited into your first vault',
          icon: 'gem',
          earned: vaults.length > 0 && totalDepositedUsdc > 0,
        },
        {
          id: 'biggest_spender',
          label: 'Big spender',
          description: 'Biggest claimer in a vault',
          icon: 'crown',
          earned: biggestSpenderTitles >= 1,
          progress: { current: Math.min(biggestSpenderTitles, 1), target: 1 },
        },
        {
          id: 'serial_traveler',
          label: 'Serial traveler',
          description: 'Closed 3+ vaults',
          icon: 'trophy',
          earned: closedVaults >= 3,
          progress: { current: Math.min(closedVaults, 3), target: 3 },
        },
        {
          id: 'streak_master',
          label: 'On a roll',
          description: '7-day expense streak',
          icon: 'zap',
          earned: streak >= 7,
          progress: { current: Math.min(streak, 7), target: 7 },
        },
      ]

      return {
        total_groups: groups.length,
        active_groups: groups.filter((g) => {
          const lastActive = new Date(g.last_activity).getTime()
          return Date.now() - lastActive < 30 * 24 * 60 * 60 * 1000
        }).length,
        total_expenses: totalExpenses,
        total_spent_across_groups: spentByCurrency,
        my_share_across_groups: myShareByCurrency,
        i_paid_count: iPaidCount,
        total_vaults: vaults.length,
        closed_vaults: closedVaults,
        total_pooled_usdc: totalPooledUsdc,
        total_deposited_usdc: totalDepositedUsdc,
        total_claimed_usdc: totalClaimedUsdc,
        total_refunded_usdc: totalRefundedUsdc,
        biggest_spender_titles: biggestSpenderTitles,
        longest_group: longestGroup,
        biggest_group: biggestGroup,
        most_active_group: mostActiveGroup,
        oldest_member_since: oldestMemberSince,
        current_streak_days: streak,
        groups,
        vaults,
        badges,
        monthly_activity: monthlyActivity,
      }
    },
  })
}