'use client'

import Link from 'next/link'
import { Receipt, ArrowRightLeft, UserPlus, Loader2, Activity } from 'lucide-react'
import { useActivityFeed, type ActivityItem } from '@/lib/hooks/useActivity'
import { formatCurrency } from '@/lib/balances'

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const actor = item.is_me_actor ? 'You' : item.actor_name

  if (item.kind === 'expense') {
    return (
      <Link
        href={`/app/groups/${item.group_id}`}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-bg-elev/40"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neon-violet/10 text-neon-violet">
          <Receipt className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug">
            <span className="font-medium">{actor}</span>
            <span className="text-fg-muted"> added </span>
            <span className="font-medium line-clamp-1 inline">{item.title}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-dim">
            <span aria-hidden="true">{item.group_emoji}</span>
            <span className="truncate">{item.group_name}</span>
            <span>·</span>
            <span>{timeAgo(item.occurred_at)}</span>
          </div>
        </div>
        {item.amount !== null && (
          <div className="shrink-0 text-right">
            <div className="tabular font-mono text-sm font-semibold">
              {formatCurrency(item.amount, item.currency || 'USD')}
            </div>
          </div>
        )}
      </Link>
    )
  }

  if (item.kind === 'settlement') {
    return (
      <Link
        href={`/app/groups/${item.group_id}`}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-bg-elev/40"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug">
            <span className="font-medium">{actor}</span>
            <span className="text-fg-muted"> paid </span>
            <span className="font-medium">{item.target_name}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-dim">
            <span aria-hidden="true">{item.group_emoji}</span>
            <span className="truncate">{item.group_name}</span>
            <span>·</span>
            <span>{timeAgo(item.occurred_at)}</span>
          </div>
        </div>
        {item.amount !== null && (
          <div className="shrink-0 text-right">
            <div className="tabular font-mono text-sm font-semibold text-success">
              {formatCurrency(item.amount, item.currency || 'USD')}
            </div>
          </div>
        )}
      </Link>
    )
  }

  return (
    <Link
      href={`/app/groups/${item.group_id}`}
      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-bg-elev/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neon-cyan/10 text-neon-cyan">
        <UserPlus className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug">
          <span className="font-medium">{actor}</span>
          <span className="text-fg-muted"> joined the group</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-dim">
          <span aria-hidden="true">{item.group_emoji}</span>
          <span className="truncate">{item.group_name}</span>
          <span>·</span>
          <span>{timeAgo(item.occurred_at)}</span>
        </div>
      </div>
    </Link>
  )
}

export function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const { data: items, isLoading } = useActivityFeed(limit)

  if (isLoading) {
    return (
      <div className="glass flex items-center justify-center rounded-2xl p-10 text-fg-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neon-cyan/10 text-neon-cyan">
          <Activity className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="font-display text-base font-semibold">No activity yet</h3>
        <p className="mt-1 text-sm text-fg-muted">Add an expense to get started.</p>
      </div>
    )
  }

  return (
    <ul className="glass divide-y divide-border/60 overflow-hidden rounded-2xl">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          <ActivityRow item={item} />
        </li>
      ))}
    </ul>
  )
}