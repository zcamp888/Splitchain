// @integration: supabase
import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { sendPushToUsers, filterByPreference } from '@/lib/push/server'

export const runtime = 'nodejs'
export const maxDuration = 30

function profileLabel(p: any): string {
  if (!p) return 'Someone'
  if (p.display_name) return p.display_name
  if (p.email && !p.email.endsWith('@wallet.splitchain.local')) return p.email.split('@')[0]
  if (p.wallet_address) return `${p.wallet_address.slice(0, 6)}…${p.wallet_address.slice(-4)}`
  return 'Someone'
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get('x-webhook-secret')
    if (secret !== process.env.PUSH_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const record = body.record
    if (!record || !record.id || !record.from_user || !record.to_user) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Only notify on confirmed settlements
    if (record.status !== 'confirmed') {
      return NextResponse.json({ skipped: 'not confirmed' })
    }

    const db = createSupabaseServiceClient()
    const [{ data: group }, { data: payer }] = await Promise.all([
      db.from('groups').select('name, cover_emoji').eq('id', record.group_id).single(),
      db.from('profiles').select('display_name, email, wallet_address').eq('id', record.from_user).single(),
    ])

    // Notify the recipient of the payment, not the sender
    const filtered = await filterByPreference([record.to_user], 'notify_settlements')
    if (filtered.length === 0) return NextResponse.json({ sent: 0, skipped: 'pref off' })

    const payerName = profileLabel(payer)
    const amountStr = formatAmount(Number(record.amount), record.currency || 'USD')
    const onChain = record.method === 'onchain' ? ' on-chain' : ''

    const result = await sendPushToUsers(filtered, {
      title: `${group?.cover_emoji || '💸'} ${group?.name || 'Settlement'}`,
      body: `${payerName} paid you ${amountStr}${onChain}`,
      url: `/app/groups/${record.group_id}`,
      tag: `settlement-${record.id}`,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('notify-settlement', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}