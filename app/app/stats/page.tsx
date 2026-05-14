import { StatsView } from '@/components/app/StatsView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function StatsPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Lifetime stats</h1>
        <p className="mt-1 text-sm text-fg-muted">Everything you&rsquo;ve done on SplitChain, in one view.</p>
      </header>
      <StatsView />
    </div>
  )
}