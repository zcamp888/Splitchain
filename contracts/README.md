# SplitChain Contracts

Trustless group escrow vaults for pre-funded trips. Members deposit USDC upfront; payers claim reimbursement during the trip; remaining balance refunds proportionally on close.

## Stack

- **Solidity** 0.8.24
- **Foundry** (forge + cast + anvil)
- **OpenZeppelin** primitives (SafeERC20, Clones, ReentrancyGuard)
- **Base Sepolia** for testnet, **Base mainnet** for production

## Architecture

**Factory + Minimal Proxy Clones** (EIP-1167):

- `GroupVaultFactory.sol` — single deployment, creates per-group vault clones (~$0.50 each on Base)
- `GroupVault.sol` — the implementation contract, cloned for each group vault

## Setup

Install Foundry:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Install dependencies (from `contracts/` directory):

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

## Test

```bash
forge test -vvv
```

Expected: **all tests pass** covering happy path, over-claim revert, non-member revert, double-close revert, dust handling, reentrancy guard, and proportional refund math.

## Coverage

```bash
forge coverage
```

## Gas snapshot

```bash
forge snapshot
```

## Deploy (later, in Phase 2)

Will use a `script/Deploy.s.sol` Foundry script — not included in this phase.

## Trust model

**Any member can claim reimbursement** (v1 design). All claims are logged on-chain via `ReimbursementClaimed` events; the SplitChain frontend indexes and displays them for full transparency. If a member abuses claims, the social/reputation layer handles it — the contract optimizes for UX speed.

## Audit status

⚠️ **Unaudited.** This is alpha software. Use testnet only until a professional audit is complete.