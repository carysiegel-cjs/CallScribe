'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlanId } from '@/lib/plans'
import type { Profile } from '@/lib/types'

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { ok: res.ok, json: await res.json().catch(() => ({})) }
}

export function ProfileForm({ profile, returnTo }: { profile: Profile; returnTo: string | null }) {
  const router = useRouter()
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'busy'; text: string } | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus({ kind: 'busy', text: 'Saving…' })
    const r = await send('/api/profile', 'PATCH', Object.fromEntries(new FormData(e.currentTarget)))
    if (!r.ok) return setStatus({ kind: 'error', text: r.json.error ?? 'Could not save' })
    setStatus({ kind: 'ok', text: 'Saved' })
    if (returnTo) router.push(returnTo)
    else router.refresh()
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <h2 className="font-medium">Business details</h2>
        <p className="text-sm text-zinc-600">Shown on invoices and used to price proposals.</p>
      </div>
      <div>
        <label className="label" htmlFor="business_name">Business name</label>
        <input id="business_name" name="business_name" required maxLength={200} className="input" defaultValue={profile.business_name ?? ''} />
      </div>
      <div>
        <label className="label" htmlFor="business_address">Address</label>
        <textarea id="business_address" name="business_address" rows={3} maxLength={500} className="input" defaultValue={profile.business_address ?? ''} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="hourly_rate">Hourly rate</label>
          <input id="hourly_rate" name="hourly_rate" type="number" min={0} step="any" className="input" defaultValue={profile.hourly_rate ?? 150} />
        </div>
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <input id="currency" name="currency" maxLength={3} pattern="[A-Za-z]{3}" title="3-letter code, e.g. USD" className="input uppercase" defaultValue={profile.currency ?? 'USD'} />
        </div>
        <div>
          <label className="label" htmlFor="payment_terms_days">Payment terms (days)</label>
          <input id="payment_terms_days" name="payment_terms_days" type="number" min={0} max={365} className="input" defaultValue={profile.payment_terms_days ?? 14} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={status?.kind === 'busy'}>{returnTo ? 'Save and continue' : 'Save'}</button>
        {status && (
          <span role={status.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${status.kind === 'error' ? 'text-red-700' : 'text-zinc-600'}`}>
            {status.text}
          </span>
        )}
      </div>
    </form>
  )
}

export function BillingCard({ plan, planName, hasCustomer, autoCheckout, usage, billingEnabled }: {
  plan: PlanId
  planName: string
  hasCustomer: boolean
  autoCheckout: 'solo' | 'pro' | null
  usage: React.ReactNode
  billingEnabled: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(false)

  async function go(url: string, body?: object) {
    setBusy(true)
    setError('')
    const r = await send(url, 'POST', body)
    if (r.json.url) window.location.href = r.json.url
    else {
      setError(r.json.error ?? 'Something went wrong')
      setBusy(false)
    }
  }

  // Plan chosen on the pricing page survives the login redirect.
  useEffect(() => {
    if (autoCheckout && !started.current) {
      started.current = true
      go('/api/stripe/checkout', { plan: autoCheckout })
    }
  }, [autoCheckout])

  const subscribed = plan !== 'free'
  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-medium">Plan</h2>
      <p className="text-sm">You are on <b>{planName}</b>.</p>
      {usage}
      <div className="flex flex-wrap gap-2">
        {!subscribed && !billingEnabled && (
          <p className="text-sm text-zinc-600">Paid plans are coming soon.</p>
        )}
        {!subscribed && billingEnabled && (
          <>
            <button disabled={busy} onClick={() => go('/api/stripe/checkout', { plan: 'solo' })} className="btn-ghost">Solo: $39/mo</button>
            <button disabled={busy} onClick={() => go('/api/stripe/checkout', { plan: 'pro' })} className="btn-primary">Pro: $79/mo</button>
          </>
        )}
        {hasCustomer && (
          <button disabled={busy} onClick={() => go('/api/stripe/portal')} className={subscribed ? 'btn-primary' : 'btn-ghost'}>
            {subscribed ? 'Change plan or billing' : 'Billing history'}
          </button>
        )}
      </div>
      {busy && <p role="status" className="text-sm text-zinc-600">Redirecting to Stripe…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
