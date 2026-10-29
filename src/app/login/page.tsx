'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const params = useSearchParams()
  const next = params.get('next') ?? '/dashboard'
  const linkError = params.get('error') === 'link'
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) {
      setError(error.message)
      setState('error')
    } else setState('sent')
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="text-xl font-semibold">Sign in to CallScribe</h1>
      {linkError && state === 'idle' && (
        <p role="alert" className="mt-3 text-sm text-red-700">That sign-in link expired or was already used. Request a new one.</p>
      )}
      {state === 'sent' ? (
        <p role="status" className="mt-4 text-sm text-zinc-600">Check <b>{email}</b> for a sign-in link. You can close this tab.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {state === 'error' && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Email me a magic link'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
