import { base, baseSepolia } from 'wagmi/chains'

export const VAULT_FACTORY_BY_CHAIN: Record<number, `0x${string}` | undefined> = {
  [baseSepolia.id]: (process.env.NEXT_PUBLIC_VAULT_FACTORY_BASE_SEPOLIA || '') as `0x${string}` | undefined,
  [base.id]: (process.env.NEXT_PUBLIC_VAULT_FACTORY_BASE || '') as `0x${string}` | undefined,
}

export const VAULT_SUPPORTED_CHAINS = [base, baseSepolia] as const

export function getFactoryAddress(chainId: number): `0x${string}` | null {
  const addr = VAULT_FACTORY_BY_CHAIN[chainId]
  if (!addr || addr.length < 10) return null
  return addr
}

export function isVaultChainSupported(chainId: number): boolean {
  return !!getFactoryAddress(chainId)
}

// USDC addresses for the chains where vaults are deployed.
// Source of truth; mirrors lib/tokens.ts.
export const VAULT_USDC: Record<number, { address: `0x${string}`; decimals: number; symbol: string }> = {
  [baseSepolia.id]: {
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    decimals: 6,
    symbol: 'USDC',
  },
  [base.id]: {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    symbol: 'USDC',
  },
}

export function getDefaultVaultChainId(): number {
  // Prefer mainnet if configured, else fall back to Sepolia.
  if (getFactoryAddress(base.id)) return base.id
  if (getFactoryAddress(baseSepolia.id)) return baseSepolia.id
  return baseSepolia.id
}