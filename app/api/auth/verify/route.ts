// @integration: supabase
import { NextResponse } from 'next/server'
import { isAddress, getAddress, verifyMessage } from 'viem'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function fail(stage: string, detail: string, status = 500, extra?: any) {
  console.error(`[verify:${stage}]`, detail, extra || '')
  return NextResponse.json(
    { error: `${stage}: ${detail}`, extra: extra || null },
    { status }
  )
}

export async function POST(req: Request) {
  let stage = 'init'
  try {
    stage = 'env-check'
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return fail(stage, 'NEXT_PUBLIC_SUPABASE_URL missing')
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail(stage, 'SUPABASE_SERVICE_ROLE_KEY missing')

    stage = 'parse-body'
    const body = await req.json().catch(() => null)
    if (!body) return fail(stage, 'invalid json', 400)
    const { address, signature, nonce } = body
    if (!address || !isAddress(address)) return fail(stage, 'invalid address', 400)
    if (!signature) return fail(stage, 'missing signature', 400)
    if (!nonce) return fail(stage, 'missing nonce', 400)

    const checksummed = getAddress(address)
    const lower = checksummed.toLowerCase()
    const db = createSupabaseServiceClient()

    stage = 'fetch-nonce'
    const { data: nonceRow, error: nonceErr } = await db
      .from('auth_nonces')
      .select('*')
      .eq('wallet_address', lower)
      .eq('nonce', nonce)
      .maybeSingle()
    if (nonceErr) return fail(stage, nonceErr.message, 500, nonceErr)
    if (!nonceRow) return fail(stage, 'nonce not found — request a new one', 401)
    if (new Date(nonceRow.expires_at) < new Date()) return fail(stage, 'nonce expired', 401)
    if (!nonceRow.issued_at) return fail(stage, 'stale nonce — retry sign in', 401)

    stage = 'verify-signature'
    const domain = req.headers.get('host') || 'splitchain.app'
    const message = `${domain} wants you to sign in with your Ethereum account:
${checksummed}

Sign in to SplitChain.

URI: https://${domain}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${nonceRow.issued_at}`

    let valid = false
    try {
      valid = await verifyMessage({ address: checksummed, message, signature })
    } catch (e) {
      return fail(stage, e instanceof Error ? e.message : 'signature verify threw', 401)
    }
    if (!valid) return fail(stage, 'invalid signature', 401)

    stage = 'consume-nonce'
    await db.from('auth_nonces').delete().eq('wallet_address', lower)

    stage = 'find-or-create-user'
    const syntheticEmail = `${lower}@wallet.splitchain.local`
    const secret = process.env.WALLET_AUTH_SECRET || 'dev-only-secret-do-not-use'
    const password = secret + lower

    let userId: string | null = null

    const { data: list, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listErr) return fail(stage, `listUsers: ${listErr.message}`, 500, listErr)
    const existing = list?.users?.find((u: any) => u.email === syntheticEmail)

    if (existing) {
      userId = existing.id
      stage = 'reset-password'
      const { error: updErr } = await db.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata || {}), wallet_address: lower },
      })
      if (updErr) return fail(stage, updErr.message, 500, updErr)
    } else {
      stage = 'create-user'
      const { data: created, error: createErr } = await db.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
        user_metadata: { wallet_address: lower },
      })
      if (createErr) {
        return fail(
          stage,
          createErr.message || 'createUser returned error',
          500,
          {
            name: createErr.name,
            status: (createErr as any).status,
            code: (createErr as any).code,
            details: JSON.stringify(createErr),
          }
        )
      }
      if (!created?.user) return fail(stage, 'createUser returned no user', 500)
      userId = created.user.id
    }

    stage = 'upsert-profile'
    const { error: profErr } = await db.from('profiles').upsert({
      id: userId!,
      wallet_address: lower,
      display_name: `${checksummed.slice(0, 6)}…${checksummed.slice(-4)}`,
      updated_at: new Date().toISOString(),
    })
    if (profErr) return fail(stage, profErr.message, 500, profErr)

    stage = 'sign-in'
    const { data: signIn, error: signInErr } = await db.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    })
    if (signInErr) return fail(stage, signInErr.message, 500, signInErr)
    if (!signIn?.session) return fail(stage, 'no session returned', 500)

    return NextResponse.json({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      user_id: userId,
    })
  } catch (e) {
    return fail(stage, e instanceof Error ? `${e.message}` : String(e), 500, {
      stack: e instanceof Error ? e.stack : undefined,
    })
  }
}
