'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Activity, Trophy, CreditCard, Settings as SettingsIcon } from 'lucide-react'
import { useUnreadCounts } from '@/lib/hooks/useActivity'

const tabs = [
  { href: '/app', label: 'Groups', icon: Home, match: (p: string) => p === '/app' || p.startsWith('/app/groups') },
  { href: '/app/activity', label: 'Activity', icon: Activity, match: (p: string) => p.startsWith('/app/activity') },
  { href: '/app/stats', label: 'Stats', icon: Trophy, match: (p: string) => p.startsWith('/app/stats') },
  { href: '/app/bills', label: 'Bills', icon: CreditCard, match: (p: string) => p.startsWith('/app/bills') },
  { href: '/app/settings', label: 'Settings', icon: SettingsIcon, match: (p: string) => p.startsWith('/app/settings') || p.startsWith('/app/receipts') },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { data: unread } = useUnreadCounts()
  const totalUnread = unread ? Object.values(unread).reduce((s, v) => s + v, 0) : 0

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-bg-elev/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 px-2 pt-2 pb-2">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          const showBadge = label === 'Activity' && totalUnread > 0
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-colors ${
                  active ? 'text-neon-violet' : 'text-fg-muted active:bg-bg-card/60'
                }`}
                style={{ minHeight: '56px' }}
              >
                <span
                  className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-all ${
                    active ? 'bg-neon-violet/15' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                  {showBadge && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-0.5 top-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-neon-violet px-1 text-[9px] font-bold text-bg shadow-lg shadow-neon-violet/40"
                    >
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </span>
                <span className={`text-[11px] font-medium leading-none ${active ? '' : 'text-fg-dim'}`}>
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}