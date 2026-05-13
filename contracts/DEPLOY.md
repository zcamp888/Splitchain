# Deploying SplitChain contracts

## Prerequisites

1. **Foundry installed** (`foundryup`)
2. **A funded deployer wallet:**
   - Base Sepolia: get test ETH from [coinbase faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
   - Base mainnet: bridge real ETH via [bridge.base.org](https://bridge.base.org)
3. **A Basescan API key** from [basescan.org](https://basescan.org/myapikey) (for contract verification)

## One-time setup

```bash
cd contracts
cp .env.example .env
# Edit .env — paste your DEPLOYER_PRIVATE_KEY and BASESCAN_API_KEY
```

⚠️ **`.env` is gitignored. Never commit it.**

## Deploy to Base Sepolia (testnet)

```bash
source .env
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

Save the **factory address** from the output — you'll paste it into the frontend env vars next phase.

Example output:
```
GroupVaultFactory deployed at: 0xABC...123
GroupVault implementation:    0xDEF...456
```

## Deploy to Base mainnet (production)

Same command, swap the network:

```bash
forge script script/Deploy.s.sol \
  --rpc-url base \
  --broadcast \
  --verify \
  -vvvv
```

⚠️ **Mainnet deploys cost real ETH. Test on Sepolia first.**

## After deploy

1. Verify the factory on [sepolia.basescan.org](https://sepolia.basescan.org) (auto-verified if `--verify` worked)
2. Copy the factory address into the SplitChain `.env.local`:
   ```
   NEXT_PUBLIC_VAULT_FACTORY_BASE_SEPOLIA=0xABC...123
   NEXT_PUBLIC_VAULT_FACTORY_BASE=0x...   # leave empty until mainnet deploy
   ```

## USDC addresses (reference)

| Network      | USDC                                         |
|--------------|----------------------------------------------|
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Base mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Get Base Sepolia USDC from the [Circle faucet](https://faucet.circle.com).