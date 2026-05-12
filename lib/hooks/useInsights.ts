'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type CategoryStat = { category: string; total: number; count: number }
export type MonthlyStat = { month: string; total: number }

export type InsightsData = {
  totalThisMonth: number
  totalLastMonth: number
  monthlyTrend: MonthlyStat[]
  topCategories: CategoryStat[]
  currency: string
}

export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: async (): Promise<InsightsData> => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const empty: InsightsData = {
        totalThisMonth: 0,
        totalLastMonth: 0,
        monthlyTrend: [],
        topCategories: [],
        currency: 'USD',
      }
      if (!user) return empty

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
      const groupIds = (memberships || []).map((m: any) => m.group_id)
      if (groupIds.length === 0) return empty

      // Pull last 6 months of expenses for groups I'm in
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)
      const cutoff = sixMonthsAgo.toISOString().slice(0, 10)

      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, currency, category, expense_date, splits:expense_splits(user_id, share_amount)')
        .in('group_id', groupIds)
        .gte('expense_date', cutoff)

      // Filter to MY share only
      const myExp = (expenses || [])
        .map((e: any) => {
          const mySplit = (e.splits || []).find((s: any) => s.user_id === user.id)
          if (!mySplit) return null
          return {
            amount: Number(mySplit.share_amount),
            currency: e.currency,
            category: e.category || 'other',
            date: e.expense_date,
          }
        })
        .filter(Boolean) as { amount: number; currency: string; category: string; date: string }[]

      // Pick the most-common currency as display currency
      const currencyCount = new Map<string, number>()
      myExp.forEach((e) => currencyCount.set(e.currency, (currencyCount.get(e.currency) || 0) + 1))
      const currency = Array.from(currencyCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD'

      // Only sum same-currency entries (no FX conversion)
      const filtered = myExp.filter((e) => e.currency === currency)

      // Monthly buckets
      const monthBuckets = new Map<string, number>()
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthBuckets.set(key, 0)
      }
      filtered.forEach((e) => {
        const key = e.date.slice(0, 7)
        if (monthBuckets.has(key)) {
          monthBuckets.set(key, monthBuckets.get(key)! + e.amount)
        }
      })

      const monthlyTrend = Array.from(monthBuckets.entries()).map(([month, total]) => ({
        month,
        total: Math.round(total * 100) / 100,
      }))

      const now = new Date()
      const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const lastMonthD = new Date(now)
      lastMonthD.setMonth(lastMonthD.getMonth() - 1)
      const lastMonthKey = `${lastMonthD.getFullYear()}-${String(lastMonthD.getMonth() + 1).padStart(2, '0')}`

      const totalThisMonth = monthBuckets.get(thisMonthKey) || 0
      const totalLastMonth = monthBuckets.get(lastMonthKey) || 0

      // Categories (this month)
      const catMap = new Map<string, { total: number; count: number }>()
      filtered
        .filter((e) => e.date.startsWith(thisMonthKey))
        .forEach((e) => {
          const c = catMap.get(e.category) || { total: 0, count: 0 }
          c.total += e.amount
          c.count += 1
          catMap.set(e.category, c)
        })
      const topCategories: CategoryStat[] = Array.from(catMap.entries())
        .map(([category, v]) => ({ category, total: Math.round(v.total * 100) / 100, count: v.count }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      return {
        totalThisMonth: Math.round(totalThisMonth * 100) / 100,
        totalLastMonth: Math.round(totalLastMonth * 100) / 100,
        monthlyTrend,
        topCategories,
        currency,
      }
    },
  })
}