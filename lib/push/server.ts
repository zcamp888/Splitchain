// @integration: supabase
import webpush from 'web-push'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

let configured = false

function configure() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@splitchain.app'
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 }
  configure()

  const db = createSupabaseServiceClient()
  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (error) throw error
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  const body = JSON.stringify(payload)
  let sent = 0
  let failed = 0
  const deadIds: string[] = []

  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        )
        sent++
      } catch (e: any) {
        failed++
        // 404 / 410 = subscription expired, clean it up
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          deadIds.push(s.id)
        } else {
          console.error('push send error', e?.statusCode, e?.message)
        }
      }
    })
  )

  if (deadIds.length > 0) {
    await db.from('push_subscriptions').delete().in('id', deadIds)
  }

  // Update last_used_at on successful sends
  const liveIds = subs.filter((s: any) => !deadIds.includes(s.id)).map((s: any) => s.id)
  if (liveIds.length > 0) {
    await db.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).in('id', liveIds)
  }

  return { sent, failed }
}

export async function getGroupRecipients(groupId: string, excludeUserId: string): Promise<string[]> {
  const db = createSupabaseServiceClient()
  const { data, error } = await db
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .neq('user_id', excludeUserId)
  if (error) throw error
  return (data || []).map((r: any) => r.user_id)
}

export async function filterByPreference(
  userIds: string[],
  pref: 'notify_expenses' | 'notify_settlements'
): Promise<string[]> {
  if (userIds.length === 0) return []
  const db = createSupabaseServiceClient()
  const { data } = await db
    .from('notification_prefs')
    .select(`user_id, ${pref}`)
    .in('user_id', userIds)

  const prefMap = new Map<string, boolean>()
  ;(data || []).forEach((r: any) => prefMap.set(r.user_id, r[pref]))

  // Default = true if no row exists
  return userIds.filter((id) => prefMap.get(id) !== false)
}