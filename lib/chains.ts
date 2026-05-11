import { base, polygon, mainnet, optimism } from 'wagmi/chains'

export const SUPPORTED_CHAINS = [base, polygon, mainnet, optimism] as const

export function getChainById(id: number) {
  return SUPPORTED_CHAINS.find((c) => c.id === id) || base
}

export function chainName(chainId: number) {
  return getChainById(chainId).name
}

export function getExplorerTxUrl(chainId: number, txHash: string) {
  const url = getChainById(chainId).blockExplorers?.default?.url
  return url ? `${url}/tx/${txHash}` : `https://etherscan.io/tx/${txHash}`
}