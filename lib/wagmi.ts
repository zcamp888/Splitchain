import { http, createConfig } from 'wagmi'
import { mainnet, base, baseSepolia, polygon, optimism } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY || ''

const connectors = [
  injected({ shimDisconnect: true }),
  coinbaseWallet({ appName: 'SplitChain' }),
]
if (projectId) {
  connectors.push(walletConnect({ projectId, showQrModal: true }) as any)
}

export const wagmiConfig = createConfig({
  chains: [mainnet, base, baseSepolia, polygon, optimism],
  connectors,
  ssr: true,
  transports: {
    [mainnet.id]: http(alchemyKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}` : undefined),
    [base.id]: http(alchemyKey ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}` : undefined),
    [baseSepolia.id]: http(alchemyKey ? `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}` : 'https://sepolia.base.org'),
    [polygon.id]: http(alchemyKey ? `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}` : undefined),
    [optimism.id]: http(alchemyKey ? `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}` : undefined),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}