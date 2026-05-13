'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type ActivityItem = {
  id: string
  kind: 'expense' | 'settlement' | 'member_joined'
  group_id: string
  occurred_at: string
  actor_id: string
  title: string | null
  amount: number | null
  currency: string | null
  target_id: string | null
  group_name?: string
  group_emoji?: string
  actor_name?: string
  target_name?: string
  is_me_actor?: boolean
}

export function useActivityFeed(limit = 30) {
  const qc = useQueryClient()
  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (channelRef.current) return

    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`activity-feed-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, () =>
        qc.invalidateQueries({ queryKey: ['activity'] })
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'settlements' }, () =>
        qc.invalidateQueries({ queryKey: ['activity'] })
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_members' }, () =>
        qc.invalidateQueries({ queryKey: ['activity'] })
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [qc])

  return useQuery({
    queryKey: ['activity', limit],
    queryFn: async (): Promise<ActivityItem[]> => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
      const groupIds = (memberships || []).map((m: any) => m.group_id)
      if (groupIds.length === 0) return []

      const { data: feed, error } = await supabase
        .from('activity_feed')
        .select('*')
        .in('group_id', groupIds)
        .order('occurred_at', { ascending: false })
        .limit(limit)
      if (error) throw error

      const [{ data: groups }, { data: profiles }] = await Promise.all([
        supabase.from('groups').select('id, name, cover_emoji').in('id', groupIds),
        supabase.from('profiles').select('id, display_name, email, wallet_address')
          .in('id', Array.from(new Set((feed || []).flatMap((f: any) => [f.actor_id, f.target_id].filter(Boolean))))),
      ])

      const groupMap = new Map((groups || []).map((g: any) => [g.id, g]))
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      const profileLabel = (id: string | null) => {
        if (!id) return ''
        const p: any = profileMap.get(id)
        if (!p) return 'Member'
        if (p.display_name) return p.display_name
        if (p.email && !p.email.endsWith('@wallet.splitchain.local')) return p.email
        if (p.wallet_address) return `${p.wallet_address.slice(0, 6)}…${p.wallet_address.slice(-4)}`
        return 'Member'
      }

      return (feed || []).map((f: any): ActivityItem => {
        const g: any = groupMap.get(f.group_id)
        return {
          ...f,
          amount: f.amount !== null ? Number(f.amount) : null,
          group_name: g?.name || 'Group',
          group_emoji: g?.cover_emoji || '💸',
          actor_name: profileLabel(f.actor_id),
          target_name: profileLabel(f.target_id),
          is_me_actor: f.actor_id === user.id,
        }
      })
    },
  })
}

export function useUnreadCounts() {
  return useQuery({
    queryKey: ['unread-counts'],
    queryFn: async (): Promise<Record<string, number>> => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return {}

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
      const groupIds = (memberships || []).map((m: any) => m.group_id)
      if (groupIds.length === 0) return {}

      const { data: seen } = await supabase
        .from('group_last_seen')
        .select('group_id, last_seen_at')
        .eq('user_id', user.id)
      const seenMap = new Map((seen || []).map((s: any) => [s.group_id, s.last_seen_at]))

      const { data: expenses } = await supabase
        .from('expenses')
        .select('group_id, created_at, paid_by')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(500)

      const counts: Record<string, number> = {}
      ;(expenses || []).forEach((e: any) => {
        if (e.paid_by === user.id) return
        const lastSeen = seenMap.get(e.group_id)
        if (!lastSeen || new Date(e.created_at) > new Date(lastSeen)) {
          counts[e.group_id] = (counts[e.group_id] || 0) + 1
        }
      })
      return counts
    },
    refetchInterval: 60_000,
  })
}

export function useMarkGroupSeen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('group_last_seen').upsert({
        user_id: user.id,
        group_id: groupId,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,group_id' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unread-counts'] }),
  })
}