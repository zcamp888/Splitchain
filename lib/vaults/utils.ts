import { keccak256, toBytes, stringToHex, pad } from 'viem'

/**
 * Convert a UUID (e.g. group ID or expense ID) into a bytes32 value
 * suitable for passing to the smart contract.
 *
 * We hash the UUID string so different UUIDs always produce different
 * bytes32 values and the mapping is irreversible from chain → off-chain
 * (which is fine — we use chain logs as a cache, not a source of truth).
 */
export function uuidToBytes32(uuid: string): `0x${string}` {
  return keccak256(toBytes(uuid))
}

/**
 * Pretty-print a bytes32 hash to a short label.
 */
export function shortHash(hash: string): string {
  if (!hash) return ''
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

/**
 * Format a uint256 amount with its decimals into a human-readable string.
 */
export function formatUnitsFixed(value: bigint, decimals: number, fractionDigits = 2): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = value / divisor
  const frac = value % divisor
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, fractionDigits)
  return fractionDigits > 0 ? `${whole.toString()}.${fracStr}` : whole.toString()
}