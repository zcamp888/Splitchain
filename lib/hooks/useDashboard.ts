'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { computeBalances } from '@/lib/balances'

export type GroupBalance = {
  group_id: string
  group_name: string
  group_emoji: string
  currency: string
  net: number // positive = you're owed, negative = you owe
  member_count: number
}

export type DashboardData = {
  groupBalances: GroupBalance[]
  totalOwedToYou: Record<string, number> // by currency
  totalYouOwe: Record<string, number>
  overdueBills: any[]
  upcomingBills: any[]
  recentActivity: any[]
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardData> => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return {
          groupBalances: [],
          totalOwedToYou: {},
          totalYouOwe: {},
          overdueBills: [],
          upcomingBills: [],
          recentActivity: [],
        }
      }

      // 1. Get all groups I'm in
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id, groups:group_id (id, name, cover_emoji, currency)')
        .eq('user_id', user.id)

      const groupIds = (memberships || []).map((m: any) => m.group_id)

      if (groupIds.length === 0) {
        const { data: bills } = await supabase
          .from('bills')
          .select('*')
          .eq('user_id', user.id)
          .eq('paid', false)
          .order('due_date', { ascending: true })
          .limit(10)

        const today = new Date().toISOString().slice(0, 10)
        return {
          groupBalances: [],
          totalOwedToYou: {},
          totalYouOwe: {},
          overdueBills: (bills || []).filter((b: any) => b.due_date < today),
          upcomingBills: (bills || []).filter((b: any) => b.due_date >= today).slice(0, 5),
          recentActivity: [],
        }
      }

      // 2. Get all members across all my groups
      const { data: allMembers } = await supabase
        .from('group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds)

      const membersByGroup = new Map<string, string[]>()
      ;(allMembers || []).forEach((m: any) => {
        const arr = membersByGroup.get(m.group_id) || []
        arr.push(m.user_id)
        membersByGroup.set(m.group_id, arr)
      })

      // 3. Get all expenses + splits across my groups
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, group_id, paid_by, amount, expense_date, description, created_at, splits:expense_splits(user_id, share_amount)')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })

      // 4. Get all settlements across my groups
      const { data: settlements } = await supabase
        .from('settlements')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })

      // 5. Compute per-group balance for me
      const groupBalances: GroupBalance[] = []
      const totalOwedToYou: Record<string, number> = {}
      const totalYouOwe: Record<string, number> = {}

      for (const m of memberships || []) {
        const g = m.groups as any
        if (!g) continue
        const memberIds = membersByGroup.get(g.id) || []
        const groupExpenses = (expenses || [])
          .filter((e: any) => e.group_id === g.id)
          .map((e: any) => ({
            id: e.id,
            paid_by: e.paid_by,
            amount: Number(e.amount),
            splits: (e.splits || []).map((s: any) => ({ user_id: s.user_id, share_amount: Number(s.share_amount) })),
          }))
        const groupSettlements = (settlements || [])
          .filter((s: any) => s.group_id === g.id)
          .map((s: any) => ({
            from_user: s.from_user,
            to_user: s.to_user,
            amount: Number(s.amount),
            status: s.status,
          }))

        const balances = computeBalances(memberIds, groupExpenses, groupSettlements)
        const myBalance = balances.find((b) => b.user_id === user.id)?.net || 0

        groupBalances.push({
          group_id: g.id,
          group_name: g.name,
          group_emoji: g.cover_emoji,
          currency: g.currency,
          net: myBalance,
          member_count: memberIds.length,
        })

        if (myBalance > 0.01) {
          totalOwedToYou[g.currency] = (totalOwedToYou[g.currency] || 0) + myBalance
        } else if (myBalance < -0.01) {
          totalYouOwe[g.currency] = (totalYouOwe[g.currency] || 0) + Math.abs(myBalance)
        }
      }

      // 6. Get my bills
      const { data: bills } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', user.id)
        .eq('paid', false)
        .order('due_date', { ascending: true })
        .limit(20)

      const today = new Date().toISOString().slice(0, 10)
      const overdueBills = (bills || []).filter((b: any) => b.due_date < today)
      const upcomingBills = (bills || []).filter((b: any) => b.due_date >= today).slice(0, 5)

      // 7. Recent activity: last 5 expenses where I'm involved
      const groupNameMap = new Map<string, { name: string; emoji: string; currency: string }>()
      ;(memberships || []).forEach((m: any) => {
        if (m.groups) groupNameMap.set(m.groups.id, { name: m.groups.name, emoji: m.groups.cover_emoji, currency: m.groups.currency })
      })

      const recentActivity = (expenses || [])
        .filter((e: any) => e.paid_by === user.id || (e.splits || []).some((s: any) => s.user_id === user.id))
        .slice(0, 5)
        .map((e: any) => {
          const meta = groupNameMap.get(e.group_id)
          const mySplit = (e.splits || []).find((s: any) => s.user_id === user.id)
          return {
            id: e.id,
            group_id: e.group_id,
            group_name: meta?.name || 'Group',
            group_emoji: meta?.emoji || '💸',
            currency: meta?.currency || 'USD',
            description: e.description,
            amount: Number(e.amount),
            paid_by_me: e.paid_by === user.id,
            my_share: mySplit ? Number(mySplit.share_amount) : 0,
            date: e.expense_date,
            created_at: e.created_at,
          }
        })

      return {
        groupBalances: groupBalances.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
        totalOwedToYou,
        totalYouOwe,
        overdueBills,
        upcomingBills,
        recentActivity,
      }
    },
  })
}