import Link from 'next/link'
import { ArrowRight, Zap, Users, Receipt, Sparkles } from 'lucide-react'

export default function HomePage() {
  return (
    <main id="main">
      <nav className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_12px_rgb(163,230,53)]" />
            SplitChain
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="btn-ghost text-sm">Sign in</Link>
            <Link href="/auth" className="btn-primary text-sm">
              Open app
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pt-20 pb-32 lg:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neon-violet/30 bg-neon-violet/5 px-4 py-1.5 text-xs font-medium text-neon-violet">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Web3-native group finance
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Split expenses.{' '}
            <span className="bg-gradient-to-br from-neon-violet via-neon-cyan to-neon-lime bg-clip-text text-transparent">
              Settle anywhere.
            </span>
          </h1>
          <p className="mt-6 text-lg text-fg-muted text-pretty">
            Track group spending in real time. No spreadsheets, no awkward reminders.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth" className="btn-primary">
              Launch app
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#features" className="btn-ghost">Learn more</a>
          </div>
        </div>

        <div id="features" className="mt-32 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Users, title: 'Group ledgers', desc: 'Shared expenses with running balances.' },
            { icon: Receipt, title: 'Smart splits', desc: 'Equal or exact splits, your choice.' },
            { icon: Zap, title: 'Realtime sync', desc: 'Everyone sees the same ledger, instantly.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-6 transition-[transform,border-color] duration-300 hover:border-neon-violet/40 hover:-translate-y-1">
              <Icon className="h-8 w-8 text-neon-cyan" aria-hidden="true" />
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-fg-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-fg-muted">
          <span>SplitChain — built on Supabase.</span>
          <Link href="/auth" className="hover:text-fg">Get started →</Link>
        </div>
      </footer>
    </main>
  )
}