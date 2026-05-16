'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useDisconnect } from 'wagmi'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()
  const { disconnect } = useDisconnect()

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    try { disconnect() } catch {}
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 active:scale-[0.98]"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Sign out
    </button>
  )
}