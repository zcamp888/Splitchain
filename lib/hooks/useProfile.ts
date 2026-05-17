'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function useMyProfile() {
  return useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, display_name, email, wallet_address')
        .eq('id', user.id)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateNickname() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nickname: string) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const trimmed = nickname.trim()
      if (trimmed.length > 40) throw new Error('Max 40 characters')

      const { error } = await supabase
        .from('profiles')
        .update({ nickname: trimmed || null, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] })
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['group'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}