// @ts-nocheck
// @integration: supabase
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type SplitInput = {
  user_id: string
  share_amount: number
  share_type?: 'equal' | 'exact' | 'percent'
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
      splits: SplitInput[]
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['group', groupId, 'expenses'] }) },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['group', groupId, 'expenses'] }) },
  })
}