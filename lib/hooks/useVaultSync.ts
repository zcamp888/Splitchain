'use client'

import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useVaultSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ vault_id }: { vault_id: string }) => {
      const res = await fetch('/api/vaults/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vault_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Sync failed')
      return json
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vaults'] })
      qc.invalidateQueries({ queryKey: ['vault-deposits', vars.vault_id] })
      qc.invalidateQueries({ queryKey: ['vault-claims', vars.vault_id] })
      qc.invalidateQueries({ queryKey: ['vault-analytics', vars.vault_id] })
    },
  })
}

// Auto-sync vaults on group view, throttled to 2 minutes per vault via sessionStorage.
export function useAutoSyncVaults(vaultIds: string[]) {
  const sync = useVaultSync()
  const firedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window === 'undefined' || vaultIds.length === 0) return

    for (const vaultId of vaultIds) {
      if (firedRef.current.has(vaultId)) continue

      const key = `sc:vault-sync:${vaultId}`
      const last = sessionStorage.getItem(key)
      const now = Date.now()
      if (last && now - parseInt(last, 10) < 2 * 60 * 1000) continue

      firedRef.current.add(vaultId)
      sessionStorage.setItem(key, String(now))
      sync.mutateAsync({ vault_id: vaultId }).catch(() => {
        // Silent — don't bother user if RPC is rate-limited
        firedRef.current.delete(vaultId)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultIds.join(',')])
}