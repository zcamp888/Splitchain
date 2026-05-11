// @ts-nocheck
/* eslint-disable */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: any) {
  try {
    const supabase: any = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { receipt_id } = await req.json()
    if (!receipt_id) return NextResponse.json({ error: 'receipt_id required' }, { status: 400 })

    const { data: receipt, error } = await supabase
      .from('receipts')
      .select('storage_path, uploaded_by')
      .eq('id', receipt_id)
      .single()
    if (error || !receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (receipt.uploaded_by !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const service: any = createSupabaseServiceClient()
    const { data: signed, error: signErr } = await service.storage
      .from('receipts')
      .createSignedUrl(receipt.storage_path, 3600)
    if (signErr) throw signErr

    return NextResponse.json({ url: signed.signedUrl })
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}