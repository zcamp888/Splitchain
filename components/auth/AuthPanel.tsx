'use client'

import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { Wallet, Mail, Loader2, ArrowRight } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useRouter } from 'next/navigation'

export function AuthPanel() {
  const [mode, setMode] = useState<'wallet' | 'email'>('wallet')
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const { push } = useToast()
  const router = useRouter()

  const handleWalletAuth = async () => {
    if (!address) return
    setLoading(true)
    try {
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const { nonce, message } = await nonceRes.json()
      if (!nonce) throw new Error('Failed to get nonce')

      const signature = await signMessageAsync({ message })

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, signature, nonce }),
      })
      const verifyJson = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyJson.error || 'Verification failed')

      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.setSession({
        access_token: verifyJson.access_token,
        refresh_token: verifyJson.refresh_token,
      })
      if (error) throw error

      push({ kind: 'success', message: 'Welcome back' })
      router.push('/app')
      router.refresh()
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Auth failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
      setEmailSent(true)
      push({ kind: 'success', message: 'Check your inbox' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Email failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-strong rounded-3xl p-8 shadow-2xl">
      <h1 className="font-display text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-fg-muted">Connect your wallet or use email.</p>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-border-strong bg-bg-elev/40 p-1">
        <button
          onClick={() => setMode('wallet')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === 'wallet' ? 'bg-bg-card text-fg' : 'text-fg-muted hover:text-fg'}`}
        >
          <Wallet className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          Wallet
        </button>
        <button
          onClick={() => setMode('email')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === 'email' ? 'bg-bg-card text-fg' : 'text-fg-muted hover:text-fg'}`}
        >
          <Mail className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          Email
        </button>
      </div>

      {mode === 'wallet' ? (
        <div className="mt-6 space-y-3">
          {!isConnected ? (
            connectors.map((c) => (
              <button key={c.uid} onClick={() => connect({ connector: c })} className="btn-ghost w-full justify-between">
                <span>{c.name}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ))
          ) : (
            <>
              <div className="rounded-xl border border-border-strong bg-bg-elev/60 px-4 py-3">
                <div className="text-xs text-fg-dim">Connected</div>
                <div className="font-mono text-sm tabular">{address?.slice(0, 6)}…{address?.slice(-4)}</div>
              </div>
              <button onClick={handleWalletAuth} disabled={loading} className="btn-primary w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Signing…
                  </>
                ) : (
                  <>
                    Sign message to continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
              <button onClick={() => disconnect()} className="text-xs text-fg-muted hover:text-fg">
                Disconnect wallet
              </button>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleEmailAuth} className="mt-6 space-y-3">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs text-fg-muted">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={emailSent}
              className="input-base"
            />
          </div>
          <button type="submit" disabled={loading || emailSent} className="btn-primary w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : emailSent ? 'Magic link sent ✓' : (
              <>
                Send magic link
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}