// @integration: supabase
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendPushToUsers } from '@/lib/push/server'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await sendPushToUsers([user.id], {
      title: '🎉 Notifications working',
      body: 'You\u2019ll get pinged when expenses and settlements happen.',
      url: '/app',
      tag: 'test',
    })

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}