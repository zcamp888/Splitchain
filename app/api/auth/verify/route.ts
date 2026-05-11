// @integration: supabase
import { NextResponse } from 'next/server'
import { isAddress, getAddress, verifyMessage } from 'viem'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { address, signature, nonce } = await req.json()
    if (!address || !isAddress(address) || !signature || !nonce) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const checksummed = getAddress(address)
    const lower = checksummed.toLowerCase()
    const db = createSupabaseServiceClient()

    const { data: nonceRow, error: nonceErr } = await db
      .from('auth_nonces')
      .select('*')
      .eq('wallet_address', lower)
      .eq('nonce', nonce)
      .single()

    if (nonceErr || !nonceRow) {
      return NextResponse.json({ error: 'Invalid nonce' }, { status: 401 })
    }
    if (new Date(nonceRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Nonce expired' }, { status: 401 })
    }

    const domain = req.headers.get('host') || 'splitchain.app'
    const message = `${domain} wants you to sign in with your Ethereum account:
${checksummed}

Sign in to SplitChain.

URI: https://${domain}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${nonceRow.created_at}`

    let valid = false
    try {
      valid = await verifyMessage({ address: checksummed, message, signature })
    } catch {
      valid = false
    }
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    await db.from('auth_nonces').delete().eq('wallet_address', lower)

    const syntheticEmail = `${lower}@wallet.splitchain.local`
    const secret = process.env.WALLET_AUTH_SECRET || 'dev-only-secret-do-not-use'
    const password = secret + lower

    let session = null
    let userId: string | null = null

    const signInResult = await db.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    })

    if (signInResult.error || !signInResult.data?.session) {
      const createResult = await db.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
        user_metadata: { wallet_address: lower },
      })
      if (createResult.error || !createResult.data?.user) {
        return NextResponse.json(
          { error: createResult.error?.message || 'User create failed' },
          { status: 500 }
        )
      }
      userId = createResult.data.user.id

      const postCreate = await db.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      })
      if (postCreate.error || !postCreate.data?.session) {
        return NextResponse.json({ error: 'Session create failed' }, { status: 500 })
      }
      session = postCreate.data.session

      await db.from('profiles').upsert({
        id: userId,
        wallet_address: lower,
        display_name: `${checksummed.slice(0, 6)}…${checksummed.slice(-4)}`,
        updated_at: new Date().toISOString(),
      })
    } else {
      session = signInResult.data.session
      userId = signInResult.data.user.id
      await db.from('profiles').upsert({
        id: userId,
        wallet_address: lower,
        updated_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user_id: userId,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verify error' },
      { status: 500 }
    )
  }
}