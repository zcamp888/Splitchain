// @ts-nocheck
// @integration: supabase
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function useCreateSettlement(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      from_user: string
      to_user: string
      amount: number
      currency: string
      status?: 'pending' | 'confirmed' | 'failed'
    }) => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('settlements')
        .insert({
          group_id: groupId,
          from_user: input.from_user,
          to_user: input.to_user,
          amount: input.amount,
          currency: input.currency,
          status: input.status || 'confirmed',
          confirmed_at: input.status !== 'failed' ? new Date().toISOString() : null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['group', groupId, 'settlements'] }) },
  })
}