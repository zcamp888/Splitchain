'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useActivityFeed } from '@/lib/hooks/useActivity'
import { useUnreadCounts } from '@/lib/hooks/useActivity'
import { formatCurrency } from '@/lib/balances'

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: items } = useActivityFeed(10)
  const { data: unread } = useUnreadCounts()
  const ref = useRef<HTMLDivElement>(null)

  const totalUnread = unread ? Object.values(unread).reduce((s, v) => s + v, 0) : 0

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2 text-fg-muted transition-colors hover:bg-bg-card hover:text-fg"
        aria-label={`Notifications${totalUnread > 0 ? `, ${totalUnread} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {totalUnread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-neon-violet px-1 text-[10px] font-semibold text-bg shadow-lg shadow-neon-violet/40"
            aria-hidden="true"
          >
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Recent activity"
          className="glass-strong absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl shadow-2xl sm:w-96"
        >
          <div className="border-b border-border/60 px-4 py-3">
            <h3 className="font-display text-sm font-semibold">Recent activity</h3>
          </div>
          {!items || items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-fg-muted">
              Nothing yet — add an expense to start.
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-border/60 overflow-y-auto">
              {items.slice(0, 8).map((item) => {
                const actor = item.is_me_actor ? 'You' : item.actor_name
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      href={`/app/groups/${item.group_id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-bg-elev/40"
                    >
                      <span className="text-lg shrink-0" aria-hidden="true">{item.group_emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs leading-snug">
                          <span className="font-medium">{actor}</span>
                          {item.kind === 'expense' && (
                            <>
                              <span className="text-fg-muted"> added </span>
                              <span className="truncate">{item.title}</span>
                            </>
                          )}
                          {item.kind === 'settlement' && (
                            <>
                              <span className="text-fg-muted"> paid </span>
                              <span>{item.target_name}</span>
                            </>
                          )}
                          {item.kind === 'member_joined' && (
                            <span className="text-fg-muted"> joined</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] text-fg-dim">
                          {item.group_name} · {timeAgo(item.occurred_at)}
                        </div>
                      </div>
                      {item.amount !== null && (
                        <div className="shrink-0 tabular font-mono text-xs font-semibold">
                          {formatCurrency(item.amount, item.currency || 'USD')}
                        </div>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <Link
            href="/app/activity"
            onClick={() => setOpen(false)}
            className="block border-t border-border/60 px-4 py-2.5 text-center text-xs font-medium text-neon-cyan hover:bg-bg-elev/40"
          >
            View all activity →
          </Link>
        </div>
      )}
    </div>
  )
}