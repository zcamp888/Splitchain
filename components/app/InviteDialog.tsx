'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Copy, Check, UserPlus, Link2, Send } from 'lucide-react'
import { useToast } from '@/components/Toaster'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'

export function InviteDialog({
  open,
  onClose,
  groupId,
  groupName,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  groupName: string
}) {
  const [mode, setMode] = useState<'link' | 'direct'>('link')
  const [recipient, setRecipient] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const { push } = useToast()
  useBodyScrollLock(open)

  useEffect(() => {
    if (open) {
      setMode('link')
      setRecipient('')
      setLink(null)
      setCopied(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const generateLink = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/invites/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      const url = `${window.location.origin}/invite/${json.invite.token}`
      setLink(url)
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  const sendDirect = async () => {
    setLoading(true)
    try {
      const trimmed = recipient.trim()
      if (!trimmed) throw new Error('Enter wallet, ENS, or email')

      let invited_wallet: string | undefined
      let invited_email: string | undefined

      if (trimmed.includes('@') && !trimmed.endsWith('.eth')) {
        invited_email = trimmed.toLowerCase()
      } else {
        const ensRes = await fetch('/api/ens/resolve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: trimmed }),
        })
        const ensJson = await ensRes.json()
        if (!ensRes.ok) throw new Error(ensJson.error || 'Could not resolve')
        invited_wallet = ensJson.address
      }

      const res = await fetch('/api/invites/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, invited_wallet, invited_email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')

      if (json.auto_added) {
        push({ kind: 'success', message: 'User added to group' })
        onClose()
      } else {
        const url = `${window.location.origin}/invite/${json.invite.token}`
        setLink(url)
        push({ kind: 'info', message: 'Invite created — share the link' })
      }
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const share = async () => {
    if (!link) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${groupName} on SplitChain`,
          text: `You're invited to join ${groupName}`,
          url: link,
        })
      } catch {
        // user cancelled
      }
    } else {
      copy()
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
      onClick={onClose}
    >
      <div className="sheet-container" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="flex items-start justify-between gap-3 px-6 pt-2">
          <div>
            <h2 id="invite-title" className="font-display text-xl font-bold tracking-tight">Invite to {groupName}</h2>
            <p className="mt-1 text-xs text-fg-muted">Share a link or invite by ENS, wallet, or email.</p>
          </div>
          <button onClick={onClose} className="btn-icon -mr-2 text-fg-muted hover:text-fg" aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border-strong bg-bg-elev/40 p-1">
            <button
              onClick={() => { setMode('link'); setLink(null) }}
              className={`min-h-[44px] rounded-lg px-3 text-sm font-medium transition-colors ${mode === 'link' ? 'bg-bg-card text-fg' : 'text-fg-muted'}`}
            >
              <Link2 className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              Link
            </button>
            <button
              onClick={() => { setMode('direct'); setLink(null) }}
              className={`min-h-[44px] rounded-lg px-3 text-sm font-medium transition-colors ${mode === 'direct' ? 'bg-bg-card text-fg' : 'text-fg-muted'}`}
            >
              <Send className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              Direct
            </button>
          </div>

          {mode === 'link' ? (
            <div className="mt-5 space-y-3">
              {!link ? (
                <button onClick={generateLink} disabled={loading} className="btn-primary w-full">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                      Generate invite link
                    </>
                  )}
                </button>
              ) : (
                <>
                  <div className="rounded-xl border border-border-strong bg-bg-elev/60 px-3 py-2.5">
                    <div className="text-xs text-fg-dim">Invite link (expires in 7&nbsp;days)</div>
                    <div className="mt-1 break-all font-mono text-xs">{link}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={copy} className="btn-ghost flex-1">
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-success" aria-hidden="true" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          Copy
                        </>
                      )}
                    </button>
                    <button onClick={share} className="btn-primary flex-1">
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Share
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div>
                <label htmlFor="invite-recipient" className="mb-1.5 block text-xs text-fg-muted">Wallet address, ENS name, or email</label>
                <input
                  id="invite-recipient"
                  name="recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="vitalik.eth, 0x…, or you@example.com"
                  autoComplete="off"
                  spellCheck={false}
                  className="input-base font-mono text-sm"
                />
              </div>
              <button onClick={sendDirect} disabled={loading || !recipient.trim()} className="btn-primary w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Create invite
                  </>
                )}
              </button>
              {link && (
                <div className="rounded-xl border border-border-strong bg-bg-elev/60 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-fg-dim">Share this link</div>
                      <div className="mt-1 truncate font-mono text-xs">{link}</div>
                    </div>
                    <button onClick={copy} className="btn-icon shrink-0 text-fg-muted hover:text-fg" aria-label="Copy link">
                      {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}