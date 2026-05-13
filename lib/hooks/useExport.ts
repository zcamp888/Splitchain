'use client'

import { useMutation } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { toCSV, downloadCSV } from '@/lib/csv'
import { computeBalances } from '@/lib/balances'

function profileLabel(p: any): string {
  if (!p) return 'Unknown'
  if (p.display_name) return p.display_name
  if (p.email && !p.email.endsWith('@wallet.splitchain.local')) return p.email
  if (p.wallet_address) return `${p.wallet_address.slice(0, 6)}…${p.wallet_address.slice(-4)}`
  return 'Member'
}

export function useExportGroupCSV() {
  return useMutation({
    mutationFn: async ({ groupId, groupName }: { groupId: string; groupName: string }) => {
      const supabase = createSupabaseBrowserClient()

      const [{ data: group }, { data: members }, { data: expenses }, { data: settlements }] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase
          .from('group_members')
          .select('user_id, profiles:user_id(id, display_name, email, wallet_address)')
          .eq('group_id', groupId),
        supabase
          .from('expenses')
          .select('id, amount, currency, description, category, expense_date, created_at, paid_by, splits:expense_splits(user_id, share_amount, share_type)')
          .eq('group_id', groupId)
          .order('expense_date', { ascending: false }),
        supabase
          .from('settlements')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false }),
      ])

      const profileMap = new Map<string, any>()
      ;(members || []).forEach((m: any) => profileMap.set(m.user_id, m.profiles))

      // === Sheet 1: Expenses (one row per expense) ===
      const expenseRows = (expenses || []).map((e: any) => ({
        date: e.expense_date,
        description: e.description,
        category: e.category || '',
        amount: Number(e.amount).toFixed(2),
        currency: e.currency,
        paid_by: profileLabel(profileMap.get(e.paid_by)),
        split_count: (e.splits || []).length,
        split_detail: (e.splits || [])
          .map((s: any) => `${profileLabel(profileMap.get(s.user_id))}: ${Number(s.share_amount).toFixed(2)}`)
          .join('; '),
      }))

      // === Sheet 2: Settlements ===
      const settlementRows = (settlements || []).map((s: any) => ({
        date: (s.confirmed_at || s.created_at).slice(0, 10),
        from: profileLabel(profileMap.get(s.from_user)),
        to: profileLabel(profileMap.get(s.to_user)),
        amount: Number(s.amount).toFixed(2),
        currency: s.currency,
        method: s.method,
        status: s.status,
        chain: s.chain_id || '',
        token: s.token_symbol || '',
        tx_hash: s.tx_hash || '',
      }))

      // === Sheet 3: Net balances ===
      const memberIds = (members || []).map((m: any) => m.user_id)
      const expLite = (expenses || []).map((e: any) => ({
        id: e.id,
        paid_by: e.paid_by,
        amount: Number(e.amount),
        splits: (e.splits || []).map((s: any) => ({ user_id: s.user_id, share_amount: Number(s.share_amount) })),
      }))
      const setLite = (settlements || []).map((s: any) => ({
        from_user: s.from_user,
        to_user: s.to_user,
        amount: Number(s.amount),
        status: s.status,
      }))
      const balances = computeBalances(memberIds, expLite, setLite)
      const balanceRows = balances.map((b) => ({
        member: profileLabel(profileMap.get(b.user_id)),
        net: b.net.toFixed(2),
        currency: group?.currency || 'USD',
        position: b.net > 0.01 ? 'owed' : b.net < -0.01 ? 'owes' : 'settled',
      }))

      // Combined CSV with section headers
      const expensesCSV = toCSV(expenseRows, ['date', 'description', 'category', 'amount', 'currency', 'paid_by', 'split_count', 'split_detail'])
      const settlementsCSV = toCSV(settlementRows, ['date', 'from', 'to', 'amount', 'currency', 'method', 'status', 'chain', 'token', 'tx_hash'])
      const balancesCSV = toCSV(balanceRows, ['member', 'net', 'currency', 'position'])

      const combined = [
        `# ${groupName} — expense ledger`,
        `# Exported ${new Date().toISOString()}`,
        '',
        '## Expenses',
        expensesCSV || '(none)',
        '',
        '## Settlements',
        settlementsCSV || '(none)',
        '',
        '## Net balances',
        balancesCSV || '(none)',
      ].join('\n')

      const safeName = groupName.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()
      const date = new Date().toISOString().slice(0, 10)
      downloadCSV(`splitchain_${safeName}_${date}.csv`, combined)
    },
  })
}

export function useExportPersonalCSV() {
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id, groups:group_id(id, name, currency, cover_emoji)')
        .eq('user_id', user.id)

      const groupIds = (memberships || []).map((m: any) => m.group_id)
      if (groupIds.length === 0) {
        downloadCSV('splitchain_personal.csv', 'No data — join a group first.')
        return
      }

      const { data: expenses } = await supabase
        .from('expenses')
        .select('group_id, amount, currency, description, category, expense_date, paid_by, splits:expense_splits(user_id, share_amount)')
        .in('group_id', groupIds)
        .order('expense_date', { ascending: false })

      const groupMap = new Map<string, any>()
      ;(memberships || []).forEach((m: any) => groupMap.set(m.group_id, m.groups))

      const rows = (expenses || [])
        .map((e: any) => {
          const mySplit = (e.splits || []).find((s: any) => s.user_id === user.id)
          const g = groupMap.get(e.group_id)
          if (!mySplit && e.paid_by !== user.id) return null
          return {
            date: e.expense_date,
            group: g?.name || 'Group',
            description: e.description,
            category: e.category || '',
            total: Number(e.amount).toFixed(2),
            my_share: mySplit ? Number(mySplit.share_amount).toFixed(2) : '0.00',
            i_paid: e.paid_by === user.id ? 'yes' : 'no',
            currency: e.currency,
          }
        })
        .filter(Boolean) as any[]

      const csv = toCSV(rows, ['date', 'group', 'description', 'category', 'total', 'my_share', 'i_paid', 'currency'])
      const date = new Date().toISOString().slice(0, 10)
      downloadCSV(`splitchain_personal_${date}.csv`, csv || 'No data')
    },
  })
}