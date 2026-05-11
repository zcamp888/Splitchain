'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { Home, Receipt, CreditCard, LogOut, Wallet } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useDisconnect } from 'wagmi'

const navItems = [
  { href: '/app', label: 'Groups', icon: Home },
  { href: '/app/bills', label: 'My bills', icon: CreditCard },
  { href: '/app/receipts', label: 'Receipts', icon: Receipt },
]

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { disconnect } = useDisconnect()
  const wallet = (user.user_metadata as { wallet_address?: string } | null)?.wallet_address

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    try { disconnect() } catch {}
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-bg-elev/40 backdrop-blur-xl lg:flex">
        <div className="px-6 py-6">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <span className="inline-block h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_12px_rgb(163,230,53)]" aria-hidden="true" />
            SplitChain
          </Link>
        </div>
        <nav className="flex-1 px-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/app' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-neon-violet/10 text-neon-violet border border-neon-violet/20' : 'text-fg-muted hover:bg-bg-card hover:text-fg'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-border/60 p-3">
          <div className="rounded-xl bg-bg-card/60 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs text-fg-dim">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              {wallet ? 'Wallet' : 'Email'}
            </div>
            <div className="mt-1 truncate font-mono text-sm tabular">
              {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : user.email}
            </div>
          </div>
          <button onClick={handleSignOut} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-bg-card hover:text-danger">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  )
}