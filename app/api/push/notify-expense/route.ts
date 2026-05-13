// @integration: supabase
import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { sendPushToUsers, getGroupRecipients, filterByPreference } from '@/lib/push/server'

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
    // Supabase webhook payload shape: { type, table, record, schema, old_record }
    const record = body.record
    if (!record || !record.id || !record.group_id || !record.paid_by) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const db = createSupabaseServiceClient()
    const [{ data: group }, { data: payer }] = await Promise.all([
      db.from('groups').select('name, cover_emoji').eq('id', record.group_id).single(),
      db.from('profiles').select('display_name, email, wallet_address').eq('id', record.paid_by).single(),
    ])

    const recipients = await getGroupRecipients(record.group_id, record.paid_by)
    const filtered = await filterByPreference(recipients, 'notify_expenses')
    if (filtered.length === 0) return NextResponse.json({ sent: 0, skipped: 'no recipients' })

    const payerName = profileLabel(payer)
    const amountStr = formatAmount(Number(record.amount), record.currency || 'USD')
    const groupName = group?.name || 'a group'

    const result = await sendPushToUsers(filtered, {
      title: `${group?.cover_emoji || '💸'} ${groupName}`,
      body: `${payerName} added ${amountStr} for ${record.description}`,
      url: `/app/groups/${record.group_id}`,
      tag: `expense-${record.id}`,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('notify-expense', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}