// @integration: supabase
'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type Vault = {
  id: string
  group_id: string
  contract_address: string
  chain_id: number
  token_address: string
  token_symbol: string
  token_decimals: number
  target_per_member: number
  name: string
  owner_address: string
  status: 'active' | 'closed'
  closed_at: string | null
  close_tx_hash: string | null
  created_by: string
  deploy_tx_hash: string
  deployed_at: string
  total_deposited: number
  total_claimed: number
  remaining_balance: number
  last_synced_at: string
  members: { user_id: string; wallet_address: string; profile?: any }[]
}

export function useGroupVaults(groupId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!groupId) return
    const supabase = createSupabaseBrowserClient()
    // Unique channel name per mount prevents StrictMode double-invocation
    // from re-attaching listeners to an already-subscribed channel.
    const channel = supabase
      .channel(`vaults:${groupId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vaults', filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ['vaults', groupId] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vault_deposits' },
        () => qc.invalidateQueries({ queryKey: ['vaults', groupId] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vault_claims' },
        () => qc.invalidateQueries({ queryKey: ['vaults', groupId] })
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [groupId, qc])

  return useQuery({
    enabled: !!groupId,
    queryKey: ['vaults', groupId],
    queryFn: async (): Promise<Vault[]> => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('vaults')
        .select(`*, vault_members(user_id, wallet_address, profiles:user_id(id, display_name, email, wallet_address))`)
        .eq('group_id', groupId)
        .order('deployed_at', { ascending: false })
      if (error) throw error
      return (data || []).map((v: any) => ({
        ...v,
        target_per_member: Number(v.target_per_member),
        total_deposited: Number(v.total_deposited),
        total_claimed: Number(v.total_claimed),
        remaining_balance: Number(v.remaining_balance),
        members: (v.vault_members || []).map((m: any) => ({
          user_id: m.user_id,
          wallet_address: m.wallet_address,
          profile: m.profiles,
        })),
      }))
    },
  })
}

export function useVaultDeposits(vaultId: string | undefined) {
  return useQuery({
    enabled: !!vaultId,
    queryKey: ['vault-deposits', vaultId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('vault_deposits')
        .select('*, profiles:member_user_id(id, display_name, email, wallet_address)')
        .eq('vault_id', vaultId)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return (data || []).map((d: any) => ({ ...d, amount: Number(d.amount) }))
    },
  })
}

export function useVaultClaims(vaultId: string | undefined) {
  return useQuery({
    enabled: !!vaultId,
    queryKey: ['vault-claims', vaultId],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('vault_claims')
        .select('*, profiles:claimer_user_id(id, display_name, email, wallet_address), expenses:expense_id(id, description, amount)')
        .eq('vault_id', vaultId)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return (data || []).map((c: any) => ({ ...c, amount: Number(c.amount) }))
    },
  })
}

// Insert the initial vault row after on-chain deployment succeeds.
// Subsequent state (deposits, claims) is appended by the indexer.
export function useRegisterVault() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      group_id: string
      contract_address: string
      chain_id: number
      token_address: string
      token_symbol: string
      token_decimals: number
      target_per_member: number
      name: string
      owner_address: string
      deploy_tx_hash: string
      members: { user_id: string; wallet_address: string }[]
    }) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: vault, error } = await supabase
        .from('vaults')
        .insert({
          group_id: input.group_id,
          contract_address: input.contract_address.toLowerCase(),
          chain_id: input.chain_id,
          token_address: input.token_address.toLowerCase(),
          token_symbol: input.token_symbol,
          token_decimals: input.token_decimals,
          target_per_member: input.target_per_member,
          name: input.name,
          owner_address: input.owner_address.toLowerCase(),
          created_by: user.id,
          deploy_tx_hash: input.deploy_tx_hash,
        })
        .select()
        .single()
      if (error) throw error

      if (input.members.length > 0) {
        const { error: memErr } = await supabase.from('vault_members').insert(
          input.members.map((m) => ({
            vault_id: vault.id,
            user_id: m.user_id,
            wallet_address: m.wallet_address.toLowerCase(),
          }))
        )
        if (memErr) throw memErr
      }

      return vault
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ['vaults', vars.group_id] })
    },
  })
}

// Record a deposit event into the off-chain cache. Called from the client
// after a deposit tx confirms. Indexer would also do this; client-side
// recording closes the loop instantly for the depositor without waiting.
export function useRecordVaultDeposit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      vault_id: string
      group_id: string
      member_address: string
      amount: number
      tx_hash: string
      block_number: number
      log_index: number
    }) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      // Upsert with conflict on (tx_hash, log_index) for idempotency
      const { error } = await supabase.from('vault_deposits').upsert(
        {
          vault_id: input.vault_id,
          member_address: input.member_address.toLowerCase(),
          member_user_id: user?.id || null,
          amount: input.amount,
          tx_hash: input.tx_hash,
          block_number: input.block_number,
          log_index: input.log_index,
          occurred_at: new Date().toISOString(),
        },
        { onConflict: 'tx_hash,log_index', ignoreDuplicates: true }
      )
      if (error && !error.message.includes('duplicate')) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vaults', vars.group_id] })
      qc.invalidateQueries({ queryKey: ['vault-deposits', vars.vault_id] })
    },
  })
}

export function useRecordVaultClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      vault_id: string
      group_id: string
      claimer_address: string
      amount: number
      expense_id_bytes32: string
      expense_id?: string | null
      tx_hash: string
      block_number: number
      log_index: number
    }) => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('vault_claims').upsert(
        {
          vault_id: input.vault_id,
          claimer_address: input.claimer_address.toLowerCase(),
          claimer_user_id: user?.id || null,
          amount: input.amount,
          expense_id_bytes32: input.expense_id_bytes32,
          expense_id: input.expense_id || null,
          tx_hash: input.tx_hash,
          block_number: input.block_number,
          log_index: input.log_index,
          occurred_at: new Date().toISOString(),
        },
        { onConflict: 'tx_hash,log_index', ignoreDuplicates: true }
      )
      if (error && !error.message.includes('duplicate')) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vaults', vars.group_id] })
      qc.invalidateQueries({ queryKey: ['vault-claims', vars.vault_id] })
    },
  })
}

export function useMarkVaultClosed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { vault_id: string; group_id: string; close_tx_hash: string }) => {
      const supabase = createSupabaseBrowserClient()
      // RLS denies authenticated updates to vaults table — this falls back
      // to a no-op gracefully. The indexer (service role) does the real update.
      // We optimistically invalidate so the UI shows pending state.
      await supabase
        .from('vaults')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          close_tx_hash: input.close_tx_hash,
        })
        .eq('id', input.vault_id)
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vaults', vars.group_id] })
    },
  })
}