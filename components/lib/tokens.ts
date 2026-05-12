import { base, polygon, mainnet, optimism } from 'wagmi/chains'

export type TokenConfig = {
  symbol: 'ETH' | 'MATIC' | 'USDC'
  decimals: number
  address: `0x${string}` | null // null = native
  chainId: number
}

export const NATIVE_BY_CHAIN: Record<number, TokenConfig> = {
  [base.id]: { symbol: 'ETH', decimals: 18, address: null, chainId: base.id },
  [optimism.id]: { symbol: 'ETH', decimals: 18, address: null, chainId: optimism.id },
  [mainnet.id]: { symbol: 'ETH', decimals: 18, address: null, chainId: mainnet.id },
  [polygon.id]: { symbol: 'MATIC', decimals: 18, address: null, chainId: polygon.id },
}

export const USDC_BY_CHAIN: Record<number, TokenConfig> = {
  [base.id]: { symbol: 'USDC', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chainId: base.id },
  [optimism.id]: { symbol: 'USDC', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', chainId: optimism.id },
  [mainnet.id]: { symbol: 'USDC', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: mainnet.id },
  [polygon.id]: { symbol: 'USDC', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', chainId: polygon.id },
}

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export function getTokenOptions(chainId: number): TokenConfig[] {
  const opts: TokenConfig[] = []
  if (NATIVE_BY_CHAIN[chainId]) opts.push(NATIVE_BY_CHAIN[chainId])
  if (USDC_BY_CHAIN[chainId]) opts.push(USDC_BY_CHAIN[chainId])
  return opts
}