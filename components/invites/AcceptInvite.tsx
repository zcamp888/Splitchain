'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'

export function AcceptInvite({
  token,
  groupName,
  groupEmoji,
  groupDescription,
  expired,
  used,
}: {
  token: string
  groupName: string
  groupEmoji: string
  groupDescription: string | null
  expired: boolean
  used: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { push } = useToast()

  const blocked = expired || used

  const handleAccept = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to accept')
      push({ kind: 'success', message: `Joined ${groupName}` })
      router.push(`/app/groups/${json.group_id}`)
      router.refresh()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-strong w-full rounded-3xl p-8">
      <div className="text-5xl" aria-hidden="true">{groupEmoji}</div>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-balance">You're invited to {groupName}</h1>
      {groupDescription && <p className="mt-2 text-sm text-fg-muted text-pretty">{groupDescription}</p>}

      {blocked ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <span>{used ? 'This invite has already been accepted.' : 'This invite has expired.'}</span>
        </div>
      ) : (
        <button onClick={handleAccept} disabled={loading} className="btn-primary mt-6 w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Joining…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Accept invite
            </>
          )}
        </button>
      )}
    </div>
  )
}