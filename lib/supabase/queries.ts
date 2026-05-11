// @ts-nocheck
// @integration: supabase
import type { SupabaseClient } from '@supabase/supabase-js'

type DB = SupabaseClient

export async function getMyGroups(supabase: DB) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('group_members')
    .select(`
      role,
      joined_at,
      groups:group_id ( id, name, description, currency, chain_id, cover_emoji, created_at, created_by )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) throw error
  return (data || []).map((r: any) => ({ ...r.groups, role: r.role })).filter(Boolean)
}

export async function getGroupDetail(supabase: DB, groupId: string) {
  const { data: group, error } = await supabase.from('groups').select('*').eq('id', groupId).single()
  if (error) throw error

  const { data: members } = await supabase
    .from('group_members')
    .select(`
      role, joined_at, user_id,
      profiles:user_id ( id, display_name, wallet_address, ens_name, avatar_url, email )
    `)
    .eq('group_id', groupId)

  return {
    ...group,
    members: (members || []).map((m: any) => ({
      role: m.role,
      joined_at: m.joined_at,
      user_id: m.user_id,
      profile: m.profiles,
    })),
  }
}

export async function getGroupExpenses(supabase: DB, groupId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id, amount, currency, description, category, expense_date, created_at, paid_by,
      paid_by_profile:paid_by ( id, display_name, wallet_address, avatar_url ),
      splits:expense_splits ( id, user_id, share_amount, share_type )
    `)
    .eq('group_id', groupId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getGroupSettlements(supabase: DB, groupId: string) {
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}