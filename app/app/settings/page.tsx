import Link from 'next/link'
import { Bell, Receipt, LogOut, User, Wallet } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase/server'
import { NotificationSettings } from '@/components/app/NotificationSettings'
import { SignOutButton } from '@/components/app/SignOutButton'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getServerUser()
  if (!user) redirect('/auth')

  const wallet = (user.user_metadata as any)?.wallet_address as string | undefined

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 sm:mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">Manage your account and notifications.</p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold sm:text-lg">
          <User className="h-4 w-4 text-neon-violet" aria-hidden="true" />
          Account
        </h2>
        <div className="glass rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-elev/60 text-fg-muted">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-fg-dim">{wallet ? 'Wallet' : 'Email'}</div>
              <div className="mt-0.5 truncate font-mono text-sm tabular">
                {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : user.email}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold sm:text-lg">
          <Receipt className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
          Tools
        </h2>
        <Link
          href="/app/receipts"
          className="glass flex items-center justify-between gap-3 rounded-2xl p-4 transition-colors active:scale-[0.98] hover:border-neon-cyan/30 sm:p-5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-cyan/10 text-neon-cyan">
              <Receipt className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="font-medium">Receipts</div>
              <div className="text-xs text-fg-dim">Scan and convert to expenses</div>
            </div>
          </div>
          <span className="text-fg-muted" aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold sm:text-lg">
          <Bell className="h-4 w-4 text-neon-lime" aria-hidden="true" />
          Notifications
        </h2>
        <NotificationSettings />
      </section>

      <section>
        <SignOutButton />
      </section>
    </div>
  )
}