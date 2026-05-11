'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Users, Loader2 } from 'lucide-react'
import { useGroups } from '@/lib/hooks/useGroups'
import { CreateGroupDialog } from '@/components/app/CreateGroupDialog'

export function GroupsDashboard() {
  const [showCreate, setShowCreate] = useState(false)
  const { data: groups, isLoading } = useGroups()

  return (
    <div>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Your groups</h1>
          <p className="mt-1 text-sm text-fg-muted">Track shared expenses and settle on-chain.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New group
        </button>
      </header>

      {isLoading ? (
        <div className="glass flex items-center justify-center rounded-2xl p-12 text-fg-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="ml-2 text-sm">Loading…</span>
        </div>
      ) : !groups || groups.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-neon-violet/10 text-neon-violet">
            <Users className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-xl font-semibold">No groups yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Create your first group to start splitting expenses with friends.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-6">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create group
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g: any) => (
            <Link
              key={g.id}
              href={`/app/groups/${g.id}`}
              className="glass group rounded-2xl p-5 transition-all duration-300 hover:border-neon-violet/40 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-3xl" aria-hidden="true">{g.cover_emoji}</div>
                <span className="rounded-full border border-border-strong bg-bg-elev/60 px-2 py-0.5 text-xs text-fg-muted">{g.role}</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-balance line-clamp-1">{g.name}</h3>
              {g.description && <p className="mt-1 text-sm text-fg-muted line-clamp-2 break-words">{g.description}</p>}
              <div className="mt-4 flex items-center justify-between text-xs text-fg-dim">
                <span>{g.currency}</span>
                <span className="text-neon-cyan transition-transform group-hover:translate-x-0.5">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateGroupDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}