import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const invite = url.searchParams.get('invite')
  const explicitNext = url.searchParams.get('next')

  if (code) {
    const supabase = createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Priority: invite token > explicit next > /app
  const dest = invite ? `/invite/${invite}` : (explicitNext ?? '/app')
  return NextResponse.redirect(new URL(dest, url.origin))
}
