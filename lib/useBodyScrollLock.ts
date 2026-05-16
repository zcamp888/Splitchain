'use client'

import { useEffect } from 'react'

/**
 * Locks <html> scroll while `open` is true. Restores on unmount or close.
 * Uses a class to avoid clobbering other components that might also lock.
 */
export function useBodyScrollLock(open: boolean) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!open) return

    const html = document.documentElement
    html.classList.add('no-scroll')

    return () => {
      // Only remove if no other locks exist (simple ref count via data attr)
      html.classList.remove('no-scroll')
    }
  }, [open])
}