# SplitChain Setup

## 1. Supabase

1. Create project at [supabase.com](https://supabase.com).
2. **Settings → API** — copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ never expose to browser
3. **SQL Editor** — run migrations **in order**:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_wave3.sql`
   - `supabase/migrations/0003_wave4.sql`
   - `supabase/migrations/0004_fix_rls.sql`
   - `supabase/migrations/0005_profiles_insert.sql`
   - `supabase/migrations/0006_fix_groups_select.sql`
   - `supabase/migrations/0007_activity.sql`
   - `supabase/migrations/0008_recurring.sql`
   - `supabase/migrations/0009_push.sql`
   - `supabase/migrations/0010_vaults.sql`
4. **Database → Replication** — confirm `expenses`, `expense_splits`, `settlements`, `group_members`, `vaults`, `vault_deposits`, `vault_claims`, `vault_refunds` are enabled on `supabase_realtime`.
5. **Storage** — confirm a private bucket named `receipts` exists (created by `0002_wave3.sql`).

## 2. Wallet auth secret

```bash
openssl rand -hex 32
```

→ `WALLET_AUTH_SECRET`. **Never change after users sign up** (derives synthetic passwords).

## 3. WalletConnect

[cloud.walletconnect.com](https://cloud.walletconnect.com) → project ID → `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

## 4. Alchemy

[alchemy.com](https://alchemy.com) → enable Base, Base Sepolia, Polygon, Mainnet, Optimism → `NEXT_PUBLIC_ALCHEMY_KEY`.

Used for ENS resolution and on-chain reads.

## 5. Claude (for receipt OCR)

1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Add $5 minimum credit (Billing → Add credits) — ~2,500 receipts
3. Click **Create Key** → copy → `ANTHROPIC_API_KEY`

Uses **Claude 3.5 Haiku** — ~$0.002 per receipt, fast and highly accurate at structured JSON extraction.

## 6. Group Vaults — deploy contracts (optional, for Web3 escrow features)

See `contracts/DEPLOY.md` for full instructions.

Quick version:

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge test  # all 23 tests should pass
cp .env.example .env  # fill in DEPLOYER_PRIVATE_KEY
source .env
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
```

Copy the deployed factory address into `.env.local`:

```
NEXT_PUBLIC_VAULT_FACTORY_BASE_SEPOLIA=0x...
NEXT_PUBLIC_VAULT_FACTORY_BASE=0x...     # after mainnet deploy
```

## 7. Run

```bash
npm install
npm run dev
```

## 8. Deploy to Vercel

1. Push to GitHub.
2. Import on [vercel.com](https://vercel.com).
3. Framework preset: **Next.js**.
4. Add ALL env vars from `.env.example` (Production + Preview + Development).
5. Deploy.

## What ships now

- ✅ SIWE + email auth
- ✅ Groups, members, realtime sync
- ✅ Expenses with equal/exact splits
- ✅ Balance engine + minimum-transfer settlement suggestions
- ✅ Shareable invite links + ENS / wallet / email direct invites
- ✅ Claude 3.5 Haiku receipt OCR
- ✅ Personal bills tracker (recurring, due dates, paid toggle)
- ✅ On-chain settlements (ETH/USDC on Base, Polygon, Optimism, Mainnet)
- ✅ Group settings, expense edit, member removal
- ✅ Recurring expenses
- ✅ Activity feed + push notifications
- ✅ CSV export
- ✅ **On-chain group vaults**