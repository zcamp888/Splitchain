'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  isPushSupported,
  isIOS,
  isStandalone,
  getPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isCurrentlySubscribed,
} from '@/lib/push/client'

export function usePushStatus() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [subscribed, setSubscribed] = useState(false)
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false)
  const [ready, setReady] = useState(false)

  const refresh = async () => {
    const sup = isPushSupported()
    setSupported(sup)
    setPermission(getPermission())
    setSubscribed(await isCurrentlySubscribed())
    setIosNeedsInstall(isIOS() && !isStandalone())
    setReady(true)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { supported, permission, subscribed, iosNeedsInstall, ready, refresh }
}

export function useSubscribePush() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const result = await subscribeToPush()
      if (!result.ok) throw new Error(result.error || 'Subscribe failed')
      return result
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-status'] }),
  })
}

export function useUnsubscribePush() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const result = await unsubscribeFromPush()
      if (!result.ok) throw new Error(result.error || 'Unsubscribe failed')
      return result
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-status'] }),
  })
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notification-prefs'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('notification_prefs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      return data || { notify_expenses: true, notify_settlements: true }
    },
  })
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (prefs: { notify_expenses?: boolean; notify_settlements?: boolean }) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('notification_prefs').upsert(
        { user_id: user.id, ...prefs },
        { onConflict: 'user_id' }
      )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  })
}