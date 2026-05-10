'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, UserPlus } from 'lucide-react'
import { useAddMemberByEmail } from '@/lib/hooks'
import { useToast } from '@/components/Toaster'

export function AddMemberDialog({
  open,
  onClose,
  groupId,
}: {
  open: boolean
  onClose: () => void
  groupId: string
}) {
  const [email, setEmail] = useState('')
  const add = useAddMemberByEmail(groupId)
  const { push } = useToast()

  useEffect(() => {
    if (open) setEmail('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await add.mutateAsync(email)
      push({ kind: 'success', message: 'Member added' })
      onClose()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="add-member-title" className="font-display text-xl font-bold tracking-tight">
              Add member
            </h2>
            <p className="mt-1 text-xs text-fg-muted">
              They must already have a SplitChain account.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-fg-muted hover:text-fg"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="member-email" className="mb-1.5 block text-xs text-fg-muted">
              Email address
            </label>
            <input
              id="member-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              placeholder="friend@example.com"
              className="input-base"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={add.isPending || !email.trim()}
              className="btn-primary"
            >
              {add.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Adding…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Add
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}