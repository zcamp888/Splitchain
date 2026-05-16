'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'sc:install-prompt-dismissed'
const DISMISS_DAYS = 7

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const ts = parseInt(raw, 10)
  if (isNaN(ts)) return false
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return
    if (isDismissed()) return

    // iOS path — no beforeinstallprompt; show manual instructions
    if (isIOS()) {
      // Delay a few seconds so it doesn't feel intrusive
      const t = setTimeout(() => setShowIOSHint(true), 4000)
      return () => clearTimeout(t)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setShow(false)
      setDeferred(null)
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferred) return
    setInstalling(true)
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        setShow(false)
      }
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // user dismissed
    } finally {
      setInstalling(false)
      setDeferred(null)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
    setShowIOSHint(false)
  }

  if (!show && !showIOSHint) return null

  return (
    <div
      role="dialog"
      aria-label="Install SplitChain"
      className="fixed inset-x-0 z-30 px-4 lg:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
    >
      <div className="glass-strong mx-auto max-w-md overflow-hidden rounded-2xl border border-neon-violet/40 shadow-2xl shadow-neon-violet/20">
        {show && deferred && (
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-cyan/30 text-neon-cyan">
              <Download className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-semibold">Install SplitChain</div>
              <p className="mt-0.5 text-xs text-fg-muted">
                Add to home screen for a faster, app-like experience.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="inline-flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-neon-violet to-neon-cyan px-3 text-xs font-medium text-bg shadow-sm active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-border-strong bg-bg-elev px-3 text-xs text-fg-muted active:scale-95"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="btn-icon shrink-0 text-fg-muted hover:text-fg"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {showIOSHint && (
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-cyan/30 text-neon-cyan">
              <Download className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-semibold">Install SplitChain</div>
              <p className="mt-0.5 text-xs text-fg-muted leading-relaxed">
                Tap <Share className="inline h-3 w-3 align-text-bottom" aria-hidden="true" /> then{' '}
                <span className="inline-flex items-center gap-0.5 rounded bg-bg-elev px-1 font-mono text-[10px]">
                  <Plus className="h-2.5 w-2.5" aria-hidden="true" />
                  Add to Home Screen
                </span>
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="btn-icon shrink-0 text-fg-muted hover:text-fg"
              aria-label="Dismiss install hint"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}