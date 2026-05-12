'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Don't auto-register in dev to avoid stale-cache headaches
    if (window.location.hostname === 'localhost') return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((e) => console.warn('SW registration failed', e))
  }, [])

  return null
}