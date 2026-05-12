'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

export function getPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    return reg
  } catch (e) {
    console.error('SW register failed', e)
    return null
  }
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { ok: false, error: 'Push not supported in this browser' }
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublic) {
    return { ok: false, error: 'VAPID public key not configured' }
  }

  if (isIOS() && !isStandalone()) {
    return {
      ok: false,
      error: 'On iOS, add SplitChain to your home screen first (Share → Add to Home Screen), then enable notifications from the installed app.',
    }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: 'Permission denied' }
  }

  const reg = await registerServiceWorker()
  if (!reg) return { ok: false, error: 'Service worker registration failed' }

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublic),
    })
  }

  const json = sub.toJSON()
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
      user_agent: navigator.userAgent.slice(0, 200),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )
  if (error) return { ok: false, error: error.message }

  return { ok: true }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'Not supported' }
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      const supabase = createSupabaseBrowserClient()
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed' }
  }
}

export async function isCurrentlySubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  if (Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}