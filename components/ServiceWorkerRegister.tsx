'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Skip in dev to avoid stale-cache headaches
    if (window.location.hostname === 'localhost') return

    // Defer so it never blocks initial render, and swallow all errors
    const id = window.setTimeout(() => {
      try {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.warn('SW registration failed (non-fatal):', e)
          })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('SW registration threw (non-fatal):', e)
      }
    }, 1500)

    return () => window.clearTimeout(id)
  }, [])

  return null
}