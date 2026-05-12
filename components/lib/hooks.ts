'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('group_members')
        .select(`role, joined_at, groups:group_id (id, name, description, currency, cover_emoji, created_at, created_by)`)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })

      if (error) throw error
      return (data || []).map((r: any) => ({ ...r.groups, role: r.role })).filter(Boolean)
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
          created_by: user.id,
        })
        .select()
        .single()
      if (error) throw error

      const { error: memberErr } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner',
      })
      if (memberErr) throw memberErr

      return group
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useUpdateGroup(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name?: string; description?: string | null; currency?: string; cover_emoji?: string }) => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.from('groups').update(input).eq('id', groupId).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] })
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.from('groups').delete().eq('id', groupId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useLeaveGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useRemoveMember(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', groupId] }),
  })
}

export function useGroupDetail(groupId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!groupId) return
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`group:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, () =>
        qc.invalidateQueries({ queryKey: ['group', groupId, 'expenses'] })
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, () =>
        qc.invalidateQueries({ queryKey: ['group', groupId, 'expenses'] })
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` }, () =>
        qc.invalidateQueries({ queryKey: ['group', groupId, 'settlements'] })
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () =>
        qc.invalidateQueries({ queryKey: ['group', groupId] })
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [groupId, qc])

  return useQuery({
    enabled: !!groupId,
    queryKey: ['group', groupId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: group, error } = await supabase.from('groups').select('*').eq('id', groupId).single()
      if (error) throw error

      const { data: members } = await supabase
        .from('group_members')
        .select(`role, joined_at, user_id, profiles:user_id (id, display_name, email, wallet_address)`)
        .eq('group_id', groupId)

      return {
        ...group,
        members: (members || []).map((m: any) => ({
          role: m.role,
          joined_at: m.joined_at,
          user_id: m.user_id,
          profile: m.profiles,
        })),
      }
    },
  })
}

export function useGroupExpenses(groupId: string | undefined) {
  return useQuery({
    enabled: !!groupId,
    queryKey: ['group', groupId, 'expenses'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('expenses')
        .select(`id, amount, currency, description, category, expense_date, created_at, paid_by,
          paid_by_profile:paid_by (id, display_name, email, wallet_address),
          splits:expense_splits (id, user_id, share_amount, share_type)`)
        .eq('group_id', groupId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

export function useGroupSettlements(groupId: string | undefined) {
  return useQuery({
    enabled: !!groupId,
    queryKey: ['group', groupId, 'settlements'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

export function useCreateExpense(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      amount: number
      description: string
      category?: string
      currency?: string
      expense_date?: string
      paid_by: string
      splits: { user_id: string; share_amount: number; share_type?: string }[]
    }) => {
      const supabase = createSupabaseBrowserClient()

      const splitsTotal = input.splits.reduce((s, x) => s + x.share_amount, 0)
      if (Math.abs(splitsTotal - input.amount) > 0.01) {
        throw new Error(`Splits (${splitsTotal.toFixed(2)}) must equal amount (${input.amount.toFixed(2)})`)
      }

      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          amount: input.amount,
          description: input.description,
          category: input.category || null,
          currency: input.currency || 'USD',
          expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
          paid_by: input.paid_by,
        })
        .select()
        .single()
      if (error) throw error

      const { error: splitErr } = await supabase.from('expense_splits').insert(
        input.splits.map((s) => ({
          expense_id: expense.id,
          user_id: s.user_id,
          share_amount: s.share_amount,
          share_type: s.share_type || 'equal',
        }))
      )
      if (splitErr) {
        await supabase.from('expenses').delete().eq('id', expense.id)
        throw splitErr
      }

      return expense
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', groupId, 'expenses'] }),
  })
}

export function useUpdateExpense(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      amount: number
      description: string
      category?: string
      currency?: string
      expense_date?: string
      paid_by: string
      splits: { user_id: string; share_amount: number; share_type?: string }[]
    }) => {
      const supabase = createSupabaseBrowserClient()

      const splitsTotal = input.splits.reduce((s, x) => s + x.share_amount, 0)
      if (Math.abs(splitsTotal - input.amount) > 0.01) {
        throw new Error(`Splits (${splitsTotal.toFixed(2)}) must equal amount (${input.amount.toFixed(2)})`)
      }

      const { error } = await supabase
        .from('expenses')
        .update({
          amount: input.amount,
          description: input.description,
          category: input.category || null,
          currency: input.currency || 'USD',
          expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
          paid_by: input.paid_by,
        })
        .eq('id', input.id)
      if (error) throw error

      const { error: delErr } = await supabase.from('expense_splits').delete().eq('expense_id', input.id)
      if (delErr) throw delErr

      const { error: insErr } = await supabase.from('expense_splits').insert(
        input.splits.map((s) => ({
          expense_id: input.id,
          user_id: s.user_id,
          share_amount: s.share_amount,
          share_type: s.share_type || 'equal',
        }))
      )
      if (insErr) throw insErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', groupId, 'expenses'] }),
  })
}

export function useDeleteExpense(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expenseId: string) => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', groupId, 'expenses'] }),
  })
}

export function useCreateSettlement(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      from_user: string
      to_user: string
      amount: number
      currency: string
      status?: 'pending' | 'confirmed' | 'failed'
      method?: 'manual' | 'onchain'
      chain_id?: number
      token_symbol?: string
      token_address?: string | null
      tx_hash?: string
      from_address?: string | null
      to_address?: string | null
    }) => {
      const supabase = createSupabaseBrowserClient()
      const status = input.status || 'confirmed'
      const { data, error } = await supabase
        .from('settlements')
        .insert({
          group_id: groupId,
          from_user: input.from_user,
          to_user: input.to_user,
          amount: input.amount,
          currency: input.currency,
          status,
          method: input.method || 'manual',
          chain_id: input.chain_id || null,
          token_symbol: input.token_symbol || null,
          token_address: input.token_address || null,
          tx_hash: input.tx_hash || null,
          from_address: input.from_address || null,
          to_address: input.to_address || null,
          confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', groupId, 'settlements'] }),
  })
}

export function useAddMemberByEmail(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const supabase = createSupabaseBrowserClient()
      const trimmed = email.trim().toLowerCase()
      if (!trimmed.includes('@')) throw new Error('Enter a valid email')

      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', trimmed)
        .maybeSingle()
      if (pErr) throw pErr
      if (!profile) throw new Error('No SplitChain user with that email. Ask them to sign up first.')

      const { data: existing } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', profile.id)
        .maybeSingle()
      if (existing) throw new Error('Already a member')

      const { error: mErr } = await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: profile.id,
        role: 'member',
      })
      if (mErr) throw mErr
      return profile
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', groupId] }),
  })
}