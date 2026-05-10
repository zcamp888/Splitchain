export type ExpenseLite = {
  id: string
  paid_by: string
  amount: number
  splits: { user_id: string; share_amount: number }[]
}

export type SettlementLite = {
  from_user: string
  to_user: string
  amount: number
  status: string
}

export function computeBalances(
  members: string[],
  expenses: ExpenseLite[],
  settlements: SettlementLite[]
) {
  const map = new Map<string, number>()
  members.forEach((m) => map.set(m, 0))

  for (const e of expenses) {
    map.set(e.paid_by, (map.get(e.paid_by) || 0) + Number(e.amount))
    for (const s of e.splits) {
      map.set(s.user_id, (map.get(s.user_id) || 0) - Number(s.share_amount))
    }
  }

  for (const s of settlements) {
    if (s.status === 'failed') continue
    map.set(s.from_user, (map.get(s.from_user) || 0) + Number(s.amount))
    map.set(s.to_user, (map.get(s.to_user) || 0) - Number(s.amount))
  }

  return Array.from(map.entries()).map(([user_id, net]) => ({
    user_id,
    net: Math.round(net * 100) / 100,
  }))
}

export function suggestTransfers(balances: { user_id: string; net: number }[]) {
  const debtors = balances
    .filter((b) => b.net < -0.01)
    .map((b) => ({ ...b, net: -b.net }))
    .sort((a, b) => b.net - a.net)
  const creditors = balances.filter((b) => b.net > 0.01).sort((a, b) => b.net - a.net)
  const transfers: { from: string; to: string; amount: number }[] = []

  let i = 0,
    j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].net, creditors[j].net)
    if (amount > 0.01) {
      transfers.push({
        from: debtors[i].user_id,
        to: creditors[j].user_id,
        amount: Math.round(amount * 100) / 100,
      })
    }
    debtors[i].net -= amount
    creditors[j].net -= amount
    if (debtors[i].net < 0.01) i++
    if (creditors[j].net < 0.01) j++
  }

  return transfers
}

export function formatCurrency(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}