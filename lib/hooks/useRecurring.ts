'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type RecurringRule = {
  id: string
  group_id: string
  paid_by: string
  amount: number
  currency: string
  description: string
  category: string | null
  frequency: 'weekly' | 'monthly' | 'yearly'
  schedule_anchor: string
  splits_template: { user_id: string; share_amount: number; share_type: string }[]
  next_run_at: string
  last_run_at: string | null
  active: boolean
  created_at: string
}

export function useGroupRecurring(groupId: string | undefined) {
  return useQuery({
    enabled: !!groupId,
    queryKey: ['recurring', groupId],
    queryFn: async (): Promise<RecurringRule[]> => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []).map((r: any) => ({
        ...r,
        amount: Number(r.amount),
        splits_template: (r.splits_template || []).map((s: any) => ({
          ...s,
          share_amount: Number(s.share_amount),
        })),
      }))
    },
  })
}

export function useCreateRecurring(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      paid_by: string
      amount: number
      currency: string
      description: string
      category?: string
      frequency: 'weekly' | 'monthly' | 'yearly'
      schedule_anchor: string
      splits_template: { user_id: string; share_amount: number; share_type: string }[]
      next_run_at: string
    }) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const splitsTotal = input.splits_template.reduce((s, x) => s + x.share_amount, 0)
      if (Math.abs(splitsTotal - input.amount) > 0.01) {
        throw new Error(`Splits (${splitsTotal.toFixed(2)}) must equal amount (${input.amount.toFixed(2)})`)
      }

      const { data, error } = await supabase
        .from('recurring_expenses')
        .insert({
          group_id: groupId,
          created_by: user.id,
          paid_by: input.paid_by,
          amount: input.amount,
          currency: input.currency,
          description: input.description,
          category: input.category || null,
          frequency: input.frequency,
          schedule_anchor: input.schedule_anchor,
          splits_template: input.splits_template,
          next_run_at: input.next_run_at,
          active: true,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring', groupId] }),
  })
}

export function useToggleRecurring(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring', groupId] }),
  })
}

export function useDeleteRecurring(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring', groupId] }),
  })
}

// Opportunistic auto-run: call from dashboard. Materializes any due rules
// for groups the current user belongs to. No cron required.
export function useAutoRunRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.rpc('run_due_recurring_expenses')
      if (error) throw error
      return data as number
    },
    onSuccess: (count) => {
      if (count && count > 0) {
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        qc.invalidateQueries({ queryKey: ['activity'] })
      }
    },
  })
}