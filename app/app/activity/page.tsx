import { ActivityFeed } from '@/components/app/ActivityFeed'

export const dynamic = 'force-dynamic'

export default function ActivityPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Activity</h1>
        <p className="mt-1 text-sm text-fg-muted">Everything happening across your groups.</p>
      </header>
      <ActivityFeed limit={50} />
    </div>
  )
}