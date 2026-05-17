// Single source of truth for "what do we call this person?"
// Priority: nickname → display_name → ENS → short wallet → email username → fallback
//
// Used across every component that shows a member name. Keep it deterministic
// and pure — no hooks, no network.

export type ProfileLike = {
  id?: string | null
  nickname?: string | null
  display_name?: string | null
  ens_name?: string | null
  email?: string | null
  wallet_address?: string | null
} | null | undefined

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function emailUsername(email: string): string | null {
  if (!email) return null
  // Hide synthetic wallet-auth emails entirely
  if (email.endsWith('@wallet.splitchain.local')) return null
  return email.split('@')[0]
}

export function displayName(profile: ProfileLike, fallback = 'Member'): string {
  if (!profile) return fallback

  const nickname = profile.nickname?.trim()
  if (nickname) return nickname

  const dn = profile.display_name?.trim()
  // display_name historically defaulted to short wallet for wallet users —
  // prefer it only if it looks like a real name (no … and no leading 0x)
  if (dn && !dn.startsWith('0x') && !dn.includes('…')) return dn

  if (profile.ens_name) return profile.ens_name

  if (profile.wallet_address) return shortAddress(profile.wallet_address)

  const username = profile.email ? emailUsername(profile.email) : null
  if (username) return username

  if (dn) return dn // fall back to the wallet-style display_name as last resort

  return fallback
}

/** Just the short wallet form, when you specifically want it. */
export { shortAddress }