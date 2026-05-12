// @integration: supabase
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { isAddress, getAddress } from 'viem'

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { group_id, invited_wallet, invited_email } = await req.json()
    if (!group_id) return NextResponse.json({ error: 'group_id required' }, { status: 400 })

    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', group_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

    let walletNorm: string | null = null
    if (invited_wallet) {
      if (!isAddress(invited_wallet)) {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
      }
      walletNorm = getAddress(invited_wallet).toLowerCase()
    }

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: invite, error } = await supabase
      .from('group_invites')
      .insert({
        group_id,
        token,
        created_by: user.id,
        invited_wallet: walletNorm,
        invited_email: invited_email || null,
        expires_at: expiresAt,
      })
      .select()
      .single()
    if (error) throw error

    // Auto-add if the invited wallet OR email already has a profile
    const service = createSupabaseServiceClient()
    let existingProfileId: string | null = null

    if (walletNorm) {
      const { data: p } = await service
        .from('profiles')
        .select('id')
        .eq('wallet_address', walletNorm)
        .maybeSingle()
      if (p) existingProfileId = p.id
    } else if (invited_email) {
      const { data: p } = await service
        .from('profiles')
        .select('id')
        .eq('email', invited_email)
        .maybeSingle()
      if (p) existingProfileId = p.id
    }

    if (existingProfileId) {
      const { data: alreadyMember } = await service
        .from('group_members')
        .select('user_id')
        .eq('group_id', group_id)
        .eq('user_id', existingProfileId)
        .maybeSingle()

      if (!alreadyMember) {
        await service.from('group_members').insert({
          group_id,
          user_id: existingProfileId,
          role: 'member',
        })
        await service.from('group_invites').update({
          accepted_by: existingProfileId,
          accepted_at: new Date().toISOString(),
        }).eq('id', invite.id)

        return NextResponse.json({ invite, auto_added: true })
      }
    }

    return NextResponse.json({ invite, auto_added: false })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invite create failed' }, { status: 500 })
  }
}