'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: string; kind: ToastKind; message: string }

const ToastCtx = createContext<{ push: (t: Omit<Toast, 'id'>) => void } | null>(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000)
  }, [])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((x) => x.id !== id))

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto glass-strong flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl"
          >
            {t.kind === 'success' && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            )}
            {t.kind === 'error' && (
              <AlertCircle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
            )}
            {t.kind === 'info' && (
              <Info className="h-5 w-5 shrink-0 text-neon-cyan" aria-hidden="true" />
            )}
            <span className="text-sm">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-2 shrink-0 text-fg-dim hover:text-fg"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}