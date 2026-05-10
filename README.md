# SplitChain

Web3-native expense splitter. Track shared spending, settle with friends.

## Stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS (dark Web3 theme)
- Supabase (Postgres + Auth + Realtime + RLS)
- wagmi + viem (SIWE wallet auth)
- TanStack Query

## Setup

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/0001_init.sql` in the SQL editor
3. Copy `.env.example` to `.env.local` and fill values
4. Install & run:

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import on [vercel.com](https://vercel.com) — Framework preset: **Next.js**
3. Add env vars from `.env.example`
4. Deploy