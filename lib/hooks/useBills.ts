// @ts-nocheck
// @integration: supabase
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function useBills() {
  return useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true })
      if (error) throw error
      return data || []
    },
  })
}

export function useCreateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      amount: number
      currency?: string
      due_date: string
      recurrence?: 'once' | 'weekly' | 'monthly' | 'yearly'
      category?: string
    }) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('bills')
        .insert({
          user_id: user.id,
          name: input.name,
          amount: input.amount,
          currency: input.currency || 'USD',
          due_date: input.due_date,
          recurrence: input.recurrence || 'once',
          category: input.category || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] })
    },
  })
}

export function useToggleBillPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.from('bills').update({ paid }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] })
    },
  })
}

export function useDeleteBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.from('bills').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] })
    },
  })
}