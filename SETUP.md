# SplitChain Setup

## 1. Supabase

1. Create project at [supabase.com](https://supabase.com).
2. **Settings → API** — copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ never expose to browser
3. **SQL Editor** — paste `supabase/migrations/0001_init.sql` and run.
4. **Database → Replication** — confirm `expenses`, `expense_splits`, `settlements`, `group_members` are enabled on `supabase_realtime`.

## 2. Wallet auth secret

```bash
openssl rand -hex 32
```

→ `WALLET_AUTH_SECRET`. **Never change after users sign up** (derives synthetic passwords).

## 3. WalletConnect

[cloud.walletconnect.com](https://cloud.walletconnect.com) → project ID → `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

## 4. Alchemy

[alchemy.com](https://alchemy.com) → enable Base, Polygon, Mainnet, Optimism → `NEXT_PUBLIC_ALCHEMY_KEY`.

## 5. Run

```bash
npm install
npm run dev
```

## 6. Deploy to Vercel

1. Push to GitHub.
2. Import on [vercel.com](https://vercel.com).
3. Framework preset: **Next.js**.
4. Add ALL env vars from `.env.example` (Production + Preview + Development).
5. Deploy.

## What ships now

- ✅ SIWE + email auth
- ✅ Groups, members, invites (link + ENS/wallet/email)
- ✅ Expenses with equal/exact splits
- ✅ Realtime sync
- ✅ Balance engine + minimum-transfer settlement suggestions
- ✅ Off-chain "mark as paid"

## Coming in Wave 3

- GPT-4o receipt OCR
- On-chain settlements (native + USDC on Base/Polygon)
- Personal bills tracking