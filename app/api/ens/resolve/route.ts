import { NextResponse } from 'next/server'
import { createPublicClient, http, isAddress, getAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY || ''

export async function POST(req: Request) {
  try {
    const { input } = await req.json()
    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'input required' }, { status: 400 })
    }
    const trimmed = input.trim()

    if (isAddress(trimmed)) {
      return NextResponse.json({ address: getAddress(trimmed), ens: null })
    }

    if (!trimmed.includes('.')) {
      return NextResponse.json({ error: 'Not a valid address or ENS name' }, { status: 400 })
    }

    const client = createPublicClient({
      chain: mainnet,
      transport: http(alchemyKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}` : undefined),
    })

    const address = await client.getEnsAddress({ name: normalize(trimmed) })
    if (!address) {
      return NextResponse.json({ error: 'ENS name does not resolve' }, { status: 404 })
    }

    return NextResponse.json({ address: getAddress(address), ens: trimmed })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'ENS resolution failed' }, { status: 500 })
  }
}