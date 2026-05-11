// @ts-nocheck
// @integration: supabase
'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getMyGroups, getGroupDetail, getGroupExpenses, getGroupSettlements } from '@/lib/supabase/queries'

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      return getMyGroups(supabase)
    },
  })
}

export function useGroupDetail(groupId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!groupId) return
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`group:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, () => {
        qc.invalidateQueries({ queryKey: ['group', groupId, 'expenses'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, () => {
        qc.invalidateQueries({ queryKey: ['group', groupId, 'expenses'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` }, () => {
        qc.invalidateQueries({ queryKey: ['group', groupId, 'settlements'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => {
        qc.invalidateQueries({ queryKey: ['group', groupId] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [groupId, qc])

  return useQuery({
    enabled: !!groupId,
    queryKey: ['group', groupId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      return getGroupDetail(supabase, groupId!)
    },
  })
}

export function useGroupExpenses(groupId: string | undefined) {
  return useQuery({
    enabled: !!groupId,
    queryKey: ['group', groupId, 'expenses'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      return getGroupExpenses(supabase, groupId!)
    },
  })
}

export function useGroupSettlements(groupId: string | undefined) {
  return useQuery({
    enabled: !!groupId,
    queryKey: ['group', groupId, 'settlements'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      return getGroupSettlements(supabase, groupId!)
    },
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; currency?: string; cover_emoji?: string }) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: group, error } = await supabase
        .from('groups')
        .insert({
          name: input.name,
          description: input.description || null,
          currency: input.currency || 'USD',
          cover_emoji: input.cover_emoji || '💸',
          chain_id: 8453,
          created_by: user.id,
        })
        .select()
        .single()
      if (error) throw error

      const { error: memberErr } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner',
        joined_at: new Date().toISOString(),
      })
      if (memberErr) throw memberErr

      return group
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }) },
  })
}