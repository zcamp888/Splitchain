'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Trash2, LogOut, UserMinus, AlertTriangle } from 'lucide-react'
import { useUpdateGroup, useDeleteGroup, useLeaveGroup, useRemoveMember } from '@/lib/hooks'
import { displayName } from '@/lib/displayName'
import { useToast } from '@/components/Toaster'

const EMOJIS = ['💸', '🏖️', '🍕', '🏠', '✈️', '🎉', '⛷️', '🚗', '🍻', '🎬', '☕', '🛒']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']

export function GroupSettingsDialog({
  open,
  onClose,
  group,
  currentUserId,
}: {
  open: boolean
  onClose: () => void
  group: any
  currentUserId: string
}) {
  const [name, setName] = useState(group?.name || '')
  const [description, setDescription] = useState(group?.description || '')
  const [currency, setCurrency] = useState(group?.currency || 'USD')
  const [emoji, setEmoji] = useState(group?.cover_emoji || '💸')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const update = useUpdateGroup(group?.id)
  const del = useDeleteGroup()
  const leave = useLeaveGroup()
  const remove = useRemoveMember(group?.id)
  const { push } = useToast()
  const router = useRouter()

  const myRole = group?.members?.find((m: any) => m.user_id === currentUserId)?.role
  const isOwner = myRole === 'owner'

  useEffect(() => {
    if (open && group) {
      setName(group.name)
      setDescription(group.description || '')
      setCurrency(group.currency)
      setEmoji(group.cover_emoji)
      setConfirmDelete(false)
      setConfirmLeave(false)
    }
  }, [open, group])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !group) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await update.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        currency,
        cover_emoji: emoji,
      })
      push({ kind: 'success', message: 'Group updated' })
      onClose()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const handleDelete = async () => {
    try {
      await del.mutateAsync(group.id)
      push({ kind: 'success', message: 'Group deleted' })
      router.push('/app')
      router.refresh()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const handleLeave = async () => {
    try {
      await leave.mutateAsync(group.id)
      push({ kind: 'success', message: 'Left group' })
      router.push('/app')
      router.refresh()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const handleRemove = async (userId: string, label: string) => {
    if (!confirm(`Remove ${label} from the group?`)) return
    try {
      await remove.mutateAsync(userId)
      push({ kind: 'success', message: 'Member removed' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={onClose}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between">
          <h2 id="settings-title" className="font-display text-xl font-bold tracking-tight">Group settings</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <fieldset disabled={!isOwner} className="space-y-4 disabled:opacity-60">
            <div>
              <label htmlFor="gs-name" className="mb-1.5 block text-xs text-fg-muted">Name</label>
              <input
                id="gs-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={60}
                autoComplete="off"
                className="input-base"
              />
            </div>
            <div>
              <label htmlFor="gs-desc" className="mb-1.5 block text-xs text-fg-muted">Description</label>
              <input
                id="gs-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={140}
                autoComplete="off"
                className="input-base"
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs text-fg-muted">Emoji</span>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all ${emoji === e ? 'bg-neon-violet/20 ring-2 ring-neon-violet/60' : 'bg-bg-elev/60 hover:bg-bg-elev'}`}
                    aria-label={`Choose ${e}`}
                    aria-pressed={emoji === e}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="gs-cur" className="mb-1.5 block text-xs text-fg-muted">Currency</label>
              <select
                id="gs-cur"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input-base"
                style={{ backgroundColor: 'rgb(var(--bg-elev))', color: 'rgb(var(--fg))' }}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {isOwner && (
              <button type="submit" disabled={update.isPending} className="btn-primary w-full">
                {update.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Saving…</>
                ) : 'Save changes'}
              </button>
            )}
          </fieldset>
        </form>

        {!isOwner && (
          <p className="mt-3 text-xs text-fg-dim">Only the owner can edit group details.</p>
        )}

        <div className="mt-6 border-t border-border/60 pt-5">
          <h3 className="mb-3 text-xs uppercase tracking-wider text-fg-muted">Members ({group.members.length})</h3>
          <ul className="space-y-1.5">
            {group.members.map((m: any) => {
              const isMe = m.user_id === currentUserId
              const label = isMe ? 'You' : displayName(m.profile)
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-bg-elev/30 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1 truncate">
                    {label}
                    {m.role === 'owner' && <span className="ml-1 rounded-full bg-neon-violet/10 px-1.5 py-0.5 text-[10px] text-neon-violet">owner</span>}
                  </div>
                  {isOwner && !isMe && (
                    <button
                      onClick={() => handleRemove(m.user_id, label)}
                      disabled={remove.isPending}
                      className="shrink-0 rounded-lg p-1.5 text-fg-dim hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      aria-label={`Remove ${label}`}
                    >
                      <UserMinus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-6 border-t border-border/60 pt-5">
          <h3 className="mb-3 text-xs uppercase tracking-wider text-danger">Danger zone</h3>

          {!isOwner ? (
            !confirmLeave ? (
              <button onClick={() => setConfirmLeave(true)} className="btn-ghost w-full text-danger hover:border-danger/40">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Leave group
              </button>
            ) : (
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                  <span>Leave this group? You&rsquo;ll lose access to all expenses and balances.</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setConfirmLeave(false)} className="btn-ghost flex-1 py-2">Cancel</button>
                  <button onClick={handleLeave} disabled={leave.isPending} className="btn-primary flex-1 bg-danger from-danger to-danger py-2">
                    {leave.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Leave'}
                  </button>
                </div>
              </div>
            )
          ) : !confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="btn-ghost w-full text-danger hover:border-danger/40">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete group
            </button>
          ) : (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                <span>Delete <strong>{group.name}</strong> permanently? All expenses and settlements will be lost. This cannot be undone.</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1 py-2">Cancel</button>
                <button onClick={handleDelete} disabled={del.isPending} className="btn-primary flex-1 bg-danger from-danger to-danger py-2">
                  {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Delete forever'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}