'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { useCreateGroup } from '@/lib/hooks'
import { useToast } from '@/components/Toaster'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'

const EMOJIS = ['💸', '🏖️', '🍕', '🏠', '✈️', '🎉', '⛷️', '🚗', '🍻', '🎬', '☕', '🛒']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']

export function CreateGroupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [emoji, setEmoji] = useState('💸')
  const create = useCreateGroup()
  const { push } = useToast()
  const router = useRouter()
  useBodyScrollLock(open)

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setCurrency('USD')
      setEmoji('💸')
    }
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
      const group = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
        cover_emoji: emoji,
      })
      push({ kind: 'success', message: `Created ${group.name}` })
      onClose()
      router.push(`/app/groups/${group.id}`)
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Create failed' })
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
      onClick={onClose}
    >
      <div
        className="sheet-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="flex items-start justify-between gap-3 px-6 pt-2">
          <h2 id="create-group-title" className="font-display text-xl font-bold tracking-tight">
            New group
          </h2>
          <button
            onClick={onClose}
            className="btn-icon -mr-2 text-fg-muted hover:text-fg"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="group-name" className="mb-1.5 block text-xs text-fg-muted">
              Name
            </label>
            <input
              id="group-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={60}
              autoComplete="off"
              autoFocus
              placeholder="Lake house weekend"
              className="input-base"
            />
          </div>

          <div>
            <label htmlFor="group-desc" className="mb-1.5 block text-xs text-fg-muted">
              Description (optional)
            </label>
            <input
              id="group-desc"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={140}
              autoComplete="off"
              placeholder="Trip with friends, June 12–14"
              className="input-base"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs text-fg-muted">Cover emoji</span>
            <div className="grid grid-cols-6 gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`flex h-12 items-center justify-center rounded-xl text-2xl transition-all active:scale-95 ${emoji === e ? 'bg-neon-violet/20 ring-2 ring-neon-violet/60' : 'bg-bg-elev/60'}`}
                  aria-label={`Choose ${e}`}
                  aria-pressed={emoji === e}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="group-currency" className="mb-1.5 block text-xs text-fg-muted">
              Currency
            </label>
            <select
              id="group-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="input-base"
              style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || !name.trim()}
              className="btn-primary flex-1"
            >
              {create.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                'Create'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}