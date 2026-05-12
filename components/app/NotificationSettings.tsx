'use client'

import { useState } from 'react'
import { Bell, BellOff, Loader2, Smartphone, Check, AlertCircle, Send } from 'lucide-react'
import {
  usePushStatus,
  useSubscribePush,
  useUnsubscribePush,
  useNotificationPrefs,
  useUpdateNotificationPrefs,
} from '@/lib/hooks/usePushNotifications'
import { useToast } from '@/components/Toaster'

export function NotificationSettings() {
  const { supported, permission, subscribed, iosNeedsInstall, ready, refresh } = usePushStatus()
  const subscribe = useSubscribePush()
  const unsubscribe = useUnsubscribePush()
  const { data: prefs } = useNotificationPrefs()
  const updatePrefs = useUpdateNotificationPrefs()
  const { push } = useToast()
  const [testing, setTesting] = useState(false)

  if (!ready) {
    return (
      <div className="glass flex items-center justify-center rounded-2xl p-8 text-fg-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  const handleSubscribe = async () => {
    try {
      await subscribe.mutateAsync()
      await refresh()
      push({ kind: 'success', message: 'Notifications enabled' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const handleUnsubscribe = async () => {
    try {
      await unsubscribe.mutateAsync()
      await refresh()
      push({ kind: 'success', message: 'Notifications disabled' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Test failed')
      if (json.sent === 0) {
        push({ kind: 'info', message: 'No active subscription — try toggling notifications off and on.' })
      } else {
        push({ kind: 'success', message: 'Test sent — check your notifications' })
      }
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setTesting(false)
    }
  }

  const handlePrefChange = async (key: 'notify_expenses' | 'notify_settlements', value: boolean) => {
    try {
      await updatePrefs.mutateAsync({ [key]: value })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${subscribed ? 'bg-success/10 text-success' : 'bg-bg-elev text-fg-muted'}`}>
            {subscribed ? <Bell className="h-5 w-5" aria-hidden="true" /> : <BellOff className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold">Push notifications</h3>
            <p className="mt-0.5 text-sm text-fg-muted">
              Get pinged when expenses are added or settlements happen.
            </p>

            {!supported && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
                <span>Your browser doesn&rsquo;t support push notifications.</span>
              </div>
            )}

            {supported && iosNeedsInstall && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-xs">
                <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-hidden="true" />
                <span>
                  On iOS, tap <strong>Share → Add to Home Screen</strong>, then open SplitChain from your home screen to enable notifications.
                </span>
              </div>
            )}

            {supported && !iosNeedsInstall && permission === 'denied' && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
                <span>Notifications blocked. Enable them in your browser settings, then refresh.</span>
              </div>
            )}

            {supported && !iosNeedsInstall && permission !== 'denied' && (
              <div className="mt-4 flex flex-wrap gap-2">
                {!subscribed ? (
                  <button onClick={handleSubscribe} disabled={subscribe.isPending} className="btn-primary text-sm">
                    {subscribe.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Enabling…</>
                    ) : (
                      <><Bell className="h-4 w-4" aria-hidden="true" />Enable notifications</>
                    )}
                  </button>
                ) : (
                  <>
                    <button onClick={handleTest} disabled={testing} className="btn-ghost text-sm">
                      {testing ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden="true" />
                      )}
                      Send test
                    </button>
                    <button onClick={handleUnsubscribe} disabled={unsubscribe.isPending} className="btn-ghost text-sm text-danger hover:border-danger/40">
                      {unsubscribe.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Disabling…</>
                      ) : (
                        <><BellOff className="h-4 w-4" aria-hidden="true" />Disable</>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {subscribed && (
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 text-xs uppercase tracking-wider text-fg-muted">What to notify me about</h3>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-bg-elev/30 px-4 py-3 transition-colors hover:border-neon-violet/30">
              <div className="min-w-0">
                <div className="text-sm font-medium">New expenses</div>
                <div className="text-xs text-fg-dim">When someone adds an expense to a group</div>
              </div>
              <input
                type="checkbox"
                checked={prefs?.notify_expenses !== false}
                onChange={(e) => handlePrefChange('notify_expenses', e.target.checked)}
                className="h-5 w-5 shrink-0 accent-neon-violet"
                aria-label="Notify on new expenses"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-bg-elev/30 px-4 py-3 transition-colors hover:border-neon-violet/30">
              <div className="min-w-0">
                <div className="text-sm font-medium">Settlements</div>
                <div className="text-xs text-fg-dim">When someone pays you back</div>
              </div>
              <input
                type="checkbox"
                checked={prefs?.notify_settlements !== false}
                onChange={(e) => handlePrefChange('notify_settlements', e.target.checked)}
                className="h-5 w-5 shrink-0 accent-neon-violet"
                aria-label="Notify on settlements"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}