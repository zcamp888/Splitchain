// @integration: supabase
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

    const { data: invite, error } = await supabase
      .from('group_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle()
    if (error) throw error
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
    }
    if (invite.accepted_by) {
      return NextResponse.json({ error: 'Invite already used' }, { status: 410 })
    }

    const { data: existing } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', invite.group_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing) {
      const { error: memberErr } = await supabase.from('group_members').insert({
        group_id: invite.group_id,
        user_id: user.id,
        role: 'member',
      })
      if (memberErr) throw memberErr
    }

    await supabase.from('group_invites').update({
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    }).eq('id', invite.id)

    return NextResponse.json({ group_id: invite.group_id })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Accept failed' }, { status: 500 })
  }
}