import { NotificationSettings } from '@/components/app/NotificationSettings'
import { Bell } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">Manage your notifications and preferences.</p>
      </header>

      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <Bell className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
          Notifications
        </h2>
        <NotificationSettings />
      </section>
    </div>
  )
}