'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, User } from 'lucide-react'
import { useMyProfile, useUpdateNickname } from '@/lib/hooks/useProfile'
import { useToast } from '@/components/Toaster'
import { displayName } from '@/lib/displayName'

export function NicknameSettings() {
  const { data: profile, isLoading } = useMyProfile()
  const update = useUpdateNickname()
  const { push } = useToast()
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) setValue(profile.nickname || '')
  }, [profile])

  const preview = displayName({ ...profile, nickname: value }, 'Member')
  const hasChanged = (profile?.nickname || '') !== value.trim()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await update.mutateAsync(value)
      setSaved(true)
      push({ kind: 'success', message: 'Nickname saved' })
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  if (isLoading) {
    return (
      <div className="glass flex items-center justify-center rounded-2xl p-6 text-fg-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-violet/10 text-neon-violet">
          <User className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="nickname" className="block text-sm font-medium">
            Display nickname
          </label>
          <p className="mt-0.5 text-xs text-fg-muted">
            How your friends see you in groups. Shown instead of your wallet or email.
          </p>

          <input
            id="nickname"
            name="nickname"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={40}
            autoComplete="nickname"
            spellCheck={false}
            placeholder="e.g. alex, satoshi, the legend"
            className="input-base mt-3"
          />

          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <span className="text-fg-dim">
              Preview: <span className="font-medium text-fg">{preview}</span>
            </span>
            <span className="tabular font-mono text-fg-dim">{value.length}/40</span>
          </div>

          <button
            type="submit"
            disabled={update.isPending || !hasChanged}
            className="btn-primary mt-3 w-full sm:w-auto"
          >
            {update.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : saved ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Saved
              </>
            ) : (
              'Save nickname'
            )}
          </button>
        </div>
      </div>
    </form>
  )
}