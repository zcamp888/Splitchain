// @integration: supabase
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function useMyReceipts() {
  return useQuery({
    queryKey: ['receipts'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

export function useUploadReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/receipts/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      return json.receipt
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] })
    },
  })
}

export function useDeleteReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.from('receipts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] })
    },
  })
}

export async function getReceiptUrl(receiptId: string): Promise<string> {
  const res = await fetch('/api/receipts/signed-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ receipt_id: receiptId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed')
  return json.url
}