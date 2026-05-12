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
4. **Database → Replication** — confirm `expenses`, `expense_splits`, `settlements`, `group_members` are enabled on `supabase_realtime`.
5. **Storage** — confirm a private bucket named `receipts` exists (created by `0002_wave3.sql`).

## 2. Wallet auth secret

```bash
openssl rand -hex 32
```

→ `WALLET_AUTH_SECRET`. **Never change after users sign up** (derives synthetic passwords).

## 3. WalletConnect

[cloud.walletconnect.com](https://cloud.walletconnect.com) → project ID → `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

## 4. Alchemy

[alchemy.com](https://alchemy.com) → enable Base, Polygon, Mainnet, Optimism → `NEXT_PUBLIC_ALCHEMY_KEY`.

Used for ENS resolution and on-chain reads.

## 5. Google Gemini (for receipt OCR) — FREE TIER

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **"Create API key"** — no credit card required
3. Copy the key → `GEMINI_API_KEY`

**Free tier:** 15 requests/minute, 1500/day. Uses `gemini-1.5-flash` with vision.
No billing setup needed for personal use.

## 6. Run

```bash
npm install
npm run dev
```

## 7. Deploy to Vercel

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
- ✅ Gemini 1.5 Flash receipt OCR (merchant, date, items, total) — FREE tier
- ✅ Personal bills tracker (recurring, due dates, paid toggle)
- ✅ On-chain settlements (ETH/USDC on Base, Polygon, Optimism, Mainnet)
- ✅ Group settings, expense edit, member removal