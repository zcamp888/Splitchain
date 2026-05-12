// @integration: supabase
import { NextResponse } from 'next/server'
import { isAddress, getAddress } from 'viem'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { address } = await req.json()
    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    const checksummed = getAddress(address)
    const lower = checksummed.toLowerCase()
    const nonce = crypto.randomUUID().replace(/-/g, '')
    const issuedAt = new Date().toISOString()
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const db = createSupabaseServiceClient()
    const { error } = await db.from('auth_nonces').upsert(
      {
        wallet_address: lower,
        nonce,
        issued_at: issuedAt,
        created_at: new Date().toISOString(),
        expires_at: expires,
      },
      { onConflict: 'wallet_address' }
    )
    if (error) throw error

    const domain = req.headers.get('host') || 'splitchain.app'
    const message = `${domain} wants you to sign in with your Ethereum account:
${checksummed}

Sign in to SplitChain.

URI: https://${domain}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${issuedAt}`

    return NextResponse.json({ nonce, message })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Nonce error' },
      { status: 500 }
    )
  }
}