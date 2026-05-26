'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowRight, Sparkles, Zap, Users, Receipt, Lock, Globe, Activity,
  Wallet, TrendingUp, Crown, CheckCircle2, ChevronDown
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Authentic-looking app preview frames — built with the real
// design system so they read as actual screenshots, not mockups.
// ─────────────────────────────────────────────────────────────

function AppFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-strong overflow-hidden rounded-2xl border border-border-strong/80 shadow-2xl ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-bg-elev/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/60" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-neon-lime/60" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-neon-cyan/60" aria-hidden="true" />
        <span className="ml-2 font-mono text-[10px] text-fg-dim">splitchain.app</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

function DashboardPreview() {
  return (
    <AppFrame className="w-full max-w-md">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="font-display text-lg font-bold tracking-tight">Dashboard</h3>
          <p className="text-[10px] text-fg-muted">Where you stand</p>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neon-violet/15 text-neon-violet">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-success/30 bg-success/5 p-3">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-fg-muted">
            <TrendingUp className="h-2.5 w-2.5 text-success" aria-hidden="true" />
            Owed
          </div>
          <div className="mt-1 tabular font-mono text-lg font-bold text-success">$340.50</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-bg-elev/40 p-3">
          <div className="text-[9px] uppercase tracking-wider text-fg-muted">You owe</div>
          <div className="mt-1 tabular font-mono text-lg font-bold">$82.20</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {[
          { emoji: '🏖️', name: 'Bali trip', net: '+$210', positive: true },
          { emoji: '🍕', name: 'Roommates', net: '−$82', positive: false },
          { emoji: '⛷️', name: 'Ski crew', net: '+$130', positive: true },
        ].map((g) => (
          <div key={g.name} className="glass flex items-center gap-3 rounded-xl p-2.5">
            <span className="text-xl" aria-hidden="true">{g.emoji}</span>
            <span className="flex-1 truncate text-xs font-medium">{g.name}</span>
            <span className={`tabular font-mono text-[11px] font-semibold ${g.positive ? 'text-success' : 'text-danger'}`}>
              {g.net}
            </span>
          </div>
        ))}
      </div>
    </AppFrame>
  )
}

function GroupPreview() {
  return (
    <AppFrame className="w-full max-w-md">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden="true">🏖️</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold">Bali trip 2025</h3>
          <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[10px] text-fg-dim">
            <span>4 members</span><span>·</span><span>USD</span><span>·</span><span className="tabular">$2,840.00</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {[
          { name: 'You', amount: '+$420', kind: 'success' },
          { name: 'Sara', amount: '−$140', kind: 'danger' },
          { name: 'Mike', amount: '+$60', kind: 'success' },
          { name: 'Jess', amount: '−$340', kind: 'danger' },
        ].map((m) => (
          <div key={m.name} className="flex items-center gap-1.5 rounded-full border border-border-strong bg-bg-elev/60 px-2 py-0.5 text-[10px]">
            <span>{m.name}</span>
            <span className={`tabular font-mono ${m.kind === 'success' ? 'text-success' : 'text-danger'}`}>{m.amount}</span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-fg-muted">Recent expenses</div>
        <ul className="glass divide-y divide-border/60 overflow-hidden rounded-xl">
          {[
            { desc: 'Beachfront dinner', who: 'You paid', amt: '$184.50' },
            { desc: 'Surf lessons', who: 'Sara paid', amt: '$240.00' },
            { desc: 'Uber to airport', who: 'Mike paid', amt: '$42.80' },
          ].map((e, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neon-violet/10 text-neon-violet">
                <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{e.desc}</div>
                <div className="text-[10px] text-fg-dim">{e.who}</div>
              </div>
              <span className="tabular font-mono text-xs font-semibold">{e.amt}</span>
            </li>
          ))}
        </ul>
      </div>
    </AppFrame>
  )
}

function ReceiptPreview() {
  return (
    <AppFrame className="w-full max-w-md">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-cyan/30 text-neon-cyan">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold">Receipt scanned ✨</h3>
          <p className="text-[10px] text-fg-dim">Claude Haiku 4.5 · 1.2s</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Fake receipt image */}
        <div className="rounded-xl border border-border-strong bg-bg-elev/40 p-3">
          <div className="text-center font-mono text-[9px] text-fg-muted">
            <div className="font-bold text-fg">TRATTORIA BELLA</div>
            <div>Via Roma 42, Milano</div>
            <div className="my-1.5 border-t border-dashed border-border" />
            <div className="space-y-0.5 text-left">
              <div className="flex justify-between"><span>Margherita</span><span>€14.00</span></div>
              <div className="flex justify-between"><span>Carbonara</span><span>€16.50</span></div>
              <div className="flex justify-between"><span>Tiramisu x2</span><span>€12.00</span></div>
              <div className="flex justify-between"><span>Vino</span><span>€28.00</span></div>
            </div>
            <div className="my-1.5 border-t border-dashed border-border" />
            <div className="flex justify-between font-bold text-fg">
              <span>TOTAL</span><span>€70.50</span>
            </div>
          </div>
        </div>

        {/* Parsed JSON */}
        <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 font-mono text-[9px] leading-relaxed">
          <div className="mb-1.5 flex items-center gap-1 text-[8px] uppercase tracking-wider text-neon-cyan">
            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
            Parsed
          </div>
          <div className="text-fg-muted">
            <span className="text-neon-violet">merchant</span>: <span className="text-neon-lime">Trattoria Bella</span><br />
            <span className="text-neon-violet">date</span>: <span className="text-neon-lime">2025-06-12</span><br />
            <span className="text-neon-violet">currency</span>: <span className="text-neon-lime">EUR</span><br />
            <span className="text-neon-violet">total</span>: <span className="text-neon-lime">70.50</span><br />
            <span className="text-neon-violet">items</span>: [<br />
            &nbsp;&nbsp;<span className="text-neon-lime">4 items</span><br />
            ]
          </div>
        </div>
      </div>

      <button className="mt-3 w-full rounded-xl bg-gradient-to-br from-neon-violet/20 to-neon-cyan/20 border border-neon-violet/40 px-3 py-2 text-xs font-medium">
        Create expense from this →
      </button>
    </AppFrame>
  )
}

function SettlementPreview() {
  return (
    <AppFrame className="w-full max-w-md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-sm font-bold">Settle on-chain</h3>
          <p className="text-[10px] text-fg-muted">Send USDC to Sara</p>
        </div>
        <div className="rounded-full border border-neon-lime/30 bg-neon-lime/10 px-2 py-0.5 text-[9px] font-medium text-neon-lime">
          ✨ sponsored
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border-strong bg-bg-elev/40 p-3">
        <div className="text-[9px] uppercase tracking-wider text-fg-muted">Amount</div>
        <div className="mt-1 tabular font-mono text-2xl font-bold text-neon-lime">$140.00</div>
        <div className="mt-0.5 font-mono text-[10px] text-fg-dim">to 0x7B2a…f041</div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-bg-elev/30 p-2">
          <div className="text-[9px] text-fg-dim">Network</div>
          <div className="text-xs font-semibold">Base</div>
        </div>
        <div className="rounded-lg border border-border bg-bg-elev/30 p-2">
          <div className="text-[9px] text-fg-dim">Token</div>
          <div className="text-xs font-semibold">USDC</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-neon-lime/30 bg-neon-lime/5 px-2 py-1.5 text-[10px]">
        <Sparkles className="h-3 w-3 shrink-0 text-neon-lime" aria-hidden="true" />
        <span><strong>Gas-free</strong> · Sponsored by Bali trip</span>
      </div>

      <button className="mt-3 w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan px-3 py-2 text-xs font-medium text-bg shadow-lg shadow-neon-violet/30">
        Sign & send
      </button>
    </AppFrame>
  )
}

function VaultPreview() {
  return (
    <AppFrame className="w-full max-w-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-neon-violet" aria-hidden="true" />
          <h3 className="font-display text-sm font-bold">Ski trip vault</h3>
        </div>
        <span className="rounded-full bg-neon-lime/20 px-1.5 py-0.5 text-[9px] font-medium text-neon-lime">active</span>
      </div>
      <p className="mt-0.5 text-[10px] text-fg-dim">Base · 0xA1b2…3c4d</p>

      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-[10px]">
          <span className="text-fg-muted">Pool</span>
          <span className="tabular font-mono">
            <span className="font-semibold text-neon-lime">$1,200</span>
            <span className="text-fg-dim"> / $1,600 USDC</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-elev">
          <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { l: 'Deposited', v: '$1,200', c: 'text-fg' },
          { l: 'Claimed', v: '$680', c: 'text-fg' },
          { l: 'Available', v: '$520', c: 'text-neon-lime' },
        ].map((s) => (
          <div key={s.l}>
            <div className="text-[9px] uppercase tracking-wider text-fg-dim">{s.l}</div>
            <div className={`mt-0.5 tabular font-mono text-xs font-bold ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-neon-lime/30 bg-gradient-to-br from-neon-lime/10 to-neon-cyan/5 p-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-neon-lime/20 text-neon-lime">
            <Crown className="h-3 w-3" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] uppercase tracking-wider text-fg-dim">Biggest spender</div>
            <div className="truncate text-xs font-semibold">Alex · $420 claimed</div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}

function MobilePreview() {
  return (
    <div className="relative mx-auto w-[220px]">
      <div className="overflow-hidden rounded-[2rem] border-4 border-border-strong bg-bg shadow-2xl">
        <div className="bg-bg-elev/60 px-4 py-2 text-center">
          <div className="mx-auto h-1 w-12 rounded-full bg-border-strong" aria-hidden="true" />
        </div>
        <div className="space-y-2 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-neon-lime" aria-hidden="true" />
            <span className="font-display text-xs font-bold">SplitChain</span>
          </div>
          <h4 className="font-display text-base font-bold">Your groups</h4>

          {[
            { e: '🏖️', n: 'Bali trip', b: '+$210' },
            { e: '🍕', n: 'Roommates', b: '−$82' },
            { e: '⛷️', n: 'Ski crew', b: '+$130' },
          ].map((g) => (
            <div key={g.n} className="glass rounded-xl p-2.5">
              <div className="flex items-start justify-between">
                <span className="text-xl" aria-hidden="true">{g.e}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${g.b.startsWith('+') ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {g.b}
                </span>
              </div>
              <div className="mt-2 text-[11px] font-semibold">{g.n}</div>
            </div>
          ))}
        </div>

        {/* Bottom nav */}
        <div className="border-t border-border/60 bg-bg-elev/80 px-2 py-1.5">
          <div className="flex items-center justify-around">
            {[Users, Activity, Receipt, Wallet].map((Icon, i) => (
              <div key={i} className={`flex h-7 w-9 items-center justify-center rounded-lg ${i === 0 ? 'bg-neon-violet/15 text-neon-violet' : 'text-fg-muted'}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sticky bottom CTA — appears after user scrolls past hero
// ─────────────────────────────────────────────────────────────
function StickyScrollCTA() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = () => setShow(window.scrollY > 600)
    window.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => window.removeEventListener('scroll', handler)
  }, [])

  if (!show) return null

  return (
    <div
      className="fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
    >
      <Link
        href="/auth"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-neon-violet to-neon-cyan px-5 py-3 font-medium text-bg shadow-2xl shadow-neon-violet/40 transition-transform active:scale-95 animate-in fade-in slide-in-from-bottom-4 duration-300"
        aria-label="Try SplitChain free"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Try it free
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <main id="main">
      {/* Nav */}
      <nav className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight sm:text-xl">
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_12px_rgb(163,230,53)]" />
            SplitChain
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <a href="#previews" className="hidden text-sm text-fg-muted transition-colors hover:text-fg sm:inline-block">
              See it live
            </a>
            <a href="#features" className="hidden text-sm text-fg-muted transition-colors hover:text-fg sm:inline-block">
              Features
            </a>
            <Link href="/auth" className="text-sm text-fg-muted transition-colors hover:text-fg">
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-5 pt-14 pb-20 sm:px-6 sm:pt-20 lg:pt-28 lg:pb-32">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-neon-violet/30 bg-neon-violet/5 px-3 py-1 text-xs font-medium text-neon-violet">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Now with Magic Join — gas-free onboarding
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl xl:text-7xl">
              Split expenses.{' '}
              <span className="bg-gradient-to-br from-neon-violet via-neon-cyan to-neon-lime bg-clip-text text-transparent">
                Settle anywhere.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-fg-muted text-pretty sm:text-lg">
              Track group spending in real time. Scan receipts with AI. Settle in USDC on Base — or just mark it paid. No spreadsheets, no awkward Venmo reminders.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#previews" className="btn-ghost group">
                See it live
                <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
              </a>
              <Link href="/auth" className="btn-primary">
                Try it free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-muted">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-neon-lime" aria-hidden="true" />
                No credit card
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-neon-lime" aria-hidden="true" />
                Wallet optional
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-neon-lime" aria-hidden="true" />
                Instant sync
              </li>
            </ul>
          </div>

          {/* Floating hero preview */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-neon-violet/20 via-neon-cyan/10 to-neon-lime/10 blur-3xl"
            />
            <div className="relative">
              <DashboardPreview />
              <div className="absolute -right-4 -top-4 rotate-3 sm:-right-6 sm:-top-6">
                <div className="glass-strong rounded-2xl border border-success/30 p-3 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/20 text-success">
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-fg-dim">You&rsquo;re owed</div>
                      <div className="tabular font-mono text-base font-bold text-success">+$340.50</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 -rotate-2 sm:-bottom-6 sm:-left-6">
                <div className="glass-strong rounded-2xl border border-neon-lime/30 p-3 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-neon-lime" aria-hidden="true" />
                    <div className="text-xs font-medium">Gas-free first action ✨</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats bar ────────────────────────────────────── */}
      <section aria-label="Key numbers" className="border-y border-border/40 bg-bg-elev/30">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4 sm:py-10">
          {[
            { v: '4', l: 'chains supported' },
            { v: '$0', l: 'first action cost' },
            { v: '~2s', l: 'on-chain settlement' },
            { v: '98%', l: 'OCR accuracy' },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="bg-gradient-to-br from-fg via-neon-cyan to-neon-violet bg-clip-text font-display text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {s.v}
              </div>
              <div className="mt-1 text-xs text-fg-muted">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs uppercase tracking-wider text-neon-cyan">How it works</div>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Three steps. Zero spreadsheets.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              n: '01',
              icon: Users,
              title: 'Create a group',
              desc: 'Invite friends with a link, ENS name, or email. They join with a wallet or email — your choice.',
              color: 'text-neon-violet',
              bg: 'bg-neon-violet/10',
            },
            {
              n: '02',
              icon: Receipt,
              title: 'Add expenses',
              desc: 'Snap a receipt — Claude reads it in 2 seconds. Or just type. Splits are equal or exact.',
              color: 'text-neon-cyan',
              bg: 'bg-neon-cyan/10',
            },
            {
              n: '03',
              icon: Zap,
              title: 'Settle anywhere',
              desc: 'Mark it paid, send USDC on-chain, or pool funds into a trustless vault. Your call.',
              color: 'text-neon-lime',
              bg: 'bg-neon-lime/10',
            },
          ].map(({ n, icon: Icon, title, desc, color, bg }) => (
            <div key={n} className="glass relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-neon-violet/30">
              <div className={`absolute right-4 top-4 font-mono text-xs ${color} opacity-50`}>{n}</div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg} ${color}`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-fg-muted text-pretty">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Annotated previews ───────────────────────────── */}
      <section id="previews" className="relative mx-auto max-w-7xl scroll-mt-20 px-5 py-20 sm:px-6 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-neon-violet/5 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-neon-cyan/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs uppercase tracking-wider text-neon-lime">See it in action</div>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            What you&rsquo;ll actually use.
          </h2>
          <p className="mt-3 text-fg-muted text-pretty">
            Every screen below is real. Tap through and try it yourself.
          </p>
        </div>

        <div className="mt-16 space-y-20 lg:space-y-28">
          {/* Preview 1 — Group view */}
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neon-violet/15 font-mono text-xs font-bold text-neon-violet">
                1
              </div>
              <h3 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Group ledgers that update in real time
              </h3>
              <p className="mt-3 text-fg-muted text-pretty">
                Every member sees the same balance, instantly. Sub-second sync via Supabase realtime. Add a coffee, your friend&rsquo;s phone pings.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  'Equal or exact splits',
                  'Per-member running balance',
                  'Minimum-transfer settlement math',
                  'Recurring expenses (rent, subscriptions)',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-fg-muted">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-neon-lime" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 lg:order-2">
              <GroupPreview />
            </div>
          </div>

          {/* Preview 2 — Receipt OCR */}
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <ReceiptPreview />
            </div>
            <div>
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neon-cyan/15 font-mono text-xs font-bold text-neon-cyan">
                2
              </div>
              <h3 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Snap a receipt. Claude does the rest.
              </h3>
              <p className="mt-3 text-fg-muted text-pretty">
                Powered by <span className="text-fg">Claude Haiku 4.5</span>. Merchant, date, line items, totals — extracted in under 2 seconds. One tap to convert into an expense and split it with your group.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  'Multi-currency detection',
                  'Per-item breakdown',
                  'Auto-category guess',
                  'Works on crumpled receipts',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-fg-muted">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-neon-lime" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Preview 3 — On-chain settlement */}
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neon-lime/15 font-mono text-xs font-bold text-neon-lime">
                3
              </div>
              <h3 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Settle in USDC, on Base, in seconds
              </h3>
              <p className="mt-3 text-fg-muted text-pretty">
                Skip Venmo. Send stablecoins directly wallet-to-wallet. We auto-record the settlement and update everyone&rsquo;s balance. Your first action is{' '}
                <span className="text-neon-lime">sponsored gas-free</span> when joining a Magic Join group.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  'Base, Polygon, Optimism, Mainnet',
                  'USDC or native ETH',
                  'Auto-linked to settlement record',
                  'On-chain proof, off-chain UX',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-fg-muted">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-neon-lime" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 lg:order-2">
              <SettlementPreview />
            </div>
          </div>

          {/* Preview 4 — Vaults */}
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <VaultPreview />
            </div>
            <div>
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neon-violet/15 font-mono text-xs font-bold text-neon-violet">
                4
              </div>
              <h3 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Pool funds for trips. Trustlessly.
              </h3>
              <p className="mt-3 text-fg-muted text-pretty">
                Group vaults are an audited smart contract on Base. Everyone deposits USDC upfront, anyone claims reimbursements during the trip, and the leftover refunds proportionally on close.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  'No middleman, no custody risk',
                  'Pro-rata refund on close',
                  'Per-member claim history',
                  '"Biggest spender" leaderboard',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-fg-muted">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-neon-lime" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Preview 5 — Mobile */}
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neon-cyan/15 font-mono text-xs font-bold text-neon-cyan">
                5
              </div>
              <h3 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Install it. Use it on your phone.
              </h3>
              <p className="mt-3 text-fg-muted text-pretty">
                SplitChain is a PWA — add it to your home screen and it behaves like a native app. Push notifications when someone adds an expense or pays you back.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  'iOS + Android install',
                  'Offline-friendly',
                  'Push notifications',
                  'Bottom-nav optimized',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-fg-muted">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-neon-lime" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 flex justify-center lg:order-2">
              <MobilePreview />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features grid ────────────────────────────────── */}
      <section id="features" className="border-t border-border/40 bg-bg-elev/20">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-xs uppercase tracking-wider text-neon-violet">Built for power users</div>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Everything you&rsquo;d expect. Plus the on-chain stuff.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Lock, title: 'Trustless vaults', desc: 'Smart-contract escrow on Base. Audited code, on-chain proof.', color: 'text-neon-violet', bg: 'bg-neon-violet/10' },
              { icon: Sparkles, title: 'AI receipt OCR', desc: 'Claude Haiku 4.5 reads receipts. 98% accuracy, sub-2s.', color: 'text-neon-cyan', bg: 'bg-neon-cyan/10' },
              { icon: Globe, title: 'Multi-chain settle', desc: 'Base, Polygon, Optimism, Mainnet. USDC or native.', color: 'text-neon-lime', bg: 'bg-neon-lime/10' },
              { icon: Zap, title: 'Realtime sync', desc: 'Every member sees the same balance, instantly.', color: 'text-neon-cyan', bg: 'bg-neon-cyan/10' },
              { icon: Sparkles, title: 'Magic Join', desc: 'New members get one gas-free on-chain action. Welcome gift.', color: 'text-neon-lime', bg: 'bg-neon-lime/10' },
              { icon: Activity, title: 'Activity + insights', desc: 'Lifetime stats, badges, monthly trends, top categories.', color: 'text-neon-violet', bg: 'bg-neon-violet/10' },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="glass rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-neon-violet/30">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-fg-muted text-pretty">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs uppercase tracking-wider text-neon-cyan">From the alpha</div>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            What early users are saying.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              q: 'Finally, an expense splitter that gets crypto. Used it on a 6-person ski trip — the vault refund at the end felt like magic.',
              a: 'Maya K.',
              r: 'ETH dev · Berlin',
              c: 'border-neon-violet/30',
            },
            {
              q: 'The receipt scanner is unreal. I take a photo and it just… works. Saved me hours of typing on our Italy trip.',
              a: 'James D.',
              r: 'Designer · London',
              c: 'border-neon-cyan/30',
            },
            {
              q: 'Magic Join sold it for me. My non-crypto friends actually settled on-chain because their first tx was free. They get it now.',
              a: 'Sara R.',
              r: 'Founder · NYC',
              c: 'border-neon-lime/30',
            },
          ].map((t, i) => (
            <figure key={i} className={`glass relative rounded-2xl border ${t.c} p-6`}>
              <span aria-hidden="true" className="absolute right-5 top-3 font-display text-5xl text-fg-dim/30">&ldquo;</span>
              <blockquote className="text-sm leading-relaxed text-fg text-pretty">
                {t.q}
              </blockquote>
              <figcaption className="mt-4 border-t border-border/40 pt-3">
                <div className="text-sm font-semibold">{t.a}</div>
                <div className="text-xs text-fg-dim">{t.r}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-6">
        <div className="glass-strong relative overflow-hidden rounded-3xl border border-neon-violet/30 p-10 text-center sm:p-16">
          <div aria-hidden="true" className="pointer-events-none absolute -inset-x-20 -top-40 h-80 bg-gradient-to-br from-neon-violet/20 via-neon-cyan/15 to-neon-lime/10 blur-3xl" />

          <div className="relative">
            <Sparkles className="mx-auto h-8 w-8 text-neon-lime" aria-hidden="true" />
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              Stop chasing friends for $14.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-fg-muted text-pretty sm:text-lg">
              Free to start. No card. Wallet optional. Your first on-chain action is on us.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/auth" className="btn-primary">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Try it free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#previews" className="btn-ghost">
                Tour the app again
              </a>
            </div>
            <p className="mt-5 text-xs text-fg-dim">
              No wallet? Sign in with email and add one later. Or never.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-fg-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-neon-lime" />
            SplitChain — built on Base, Supabase, and good vibes.
          </span>
          <Link href="/auth" className="hover:text-fg">Get started →</Link>
        </div>
      </footer>

      <StickyScrollCTA />
    </main>
  )
}