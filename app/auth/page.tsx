import Link from 'next/link'
import { AuthPanel } from '@/components/AuthPanel'

export default function AuthPage() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <div className="w-full">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_12px_rgb(163,230,53)]" />
          SplitChain
        </Link>
        <AuthPanel />
      </div>
    </main>
  )
}