'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

// Re-export from main hooks file for legacy imports (Phase 1 components).
export { useCreateExpense, useUpdateExpense, useDeleteExpense } from '@/lib/hooks'

// Optional dialog hook: after a fresh expense is added, return its data so
// the caller can prompt for vault claim. Lives here to keep main hooks file
// tidy.
export function useClaimableExpense() {
  return useMutation({
    mutationFn: async (expenseId: string) => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, amount, currency, paid_by, group_id')
        .eq('id', expenseId)
        .single()
      if (error) throw error
      return data
    },
  })
}