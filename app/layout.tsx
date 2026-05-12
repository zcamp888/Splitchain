import type { Metadata, Viewport } from 'next'
import { Sora, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import './globals.css'

const sora = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'SplitChain — Web3-native expense splitting',
  description: 'Split expenses with friends. Settle anywhere.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SplitChain',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0b14',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="min-h-screen bg-bg text-fg antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-neon-violet focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to main content
        </a>
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-neon-violet/20 blur-[120px]" />
          <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-neon-cyan/15 blur-[140px]" />
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-neon-lime/10 blur-[120px]" />
        </div>
        <Providers>
          <ServiceWorkerRegister />
          {children}
        </Providers>
      </body>
    </html>
  )
}