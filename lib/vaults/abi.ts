// ABIs for GroupVaultFactory and GroupVault contracts.
// Hand-curated minimal subset — only the functions/events the frontend needs.

export const FACTORY_ABI = [
  {
    type: 'function',
    name: 'createVault',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'groupId', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'targetPerMember', type: 'uint256' },
      { name: 'members', type: 'address[]' },
    ],
    outputs: [{ name: 'vault', type: 'address' }],
  },
  {
    type: 'function',
    name: 'implementation',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'vaultsOf',
    stateMutability: 'view',
    inputs: [{ name: 'groupId', type: 'bytes32' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'event',
    name: 'VaultCreated',
    inputs: [
      { name: 'groupId', type: 'bytes32', indexed: true },
      { name: 'vault', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'targetPerMember', type: 'uint256', indexed: false },
      { name: 'memberCount', type: 'uint256', indexed: false },
    ],
  },
] as const

export const VAULT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimReimbursement',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'expenseId', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'close',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'closed',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'token',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'targetPerMember',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deposited',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimed',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalDeposited',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalClaimed',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'remainingBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isMember',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'members',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'member', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'newBalance', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReimbursementClaimed',
    inputs: [
      { name: 'member', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'expenseId', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'VaultClosed',
    inputs: [
      { name: 'totalRefunded', type: 'uint256', indexed: false },
      { name: 'memberCount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Refunded',
    inputs: [
      { name: 'member', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const