'use client'

import { useState } from 'react'
import type { PlanId } from '@/lib/plans'
import type { Profile } from '@/lib/types'

export function ProfileForm({ profile }: { profile: Profile }) {
  const [saved, setSaved] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved('Saving…')
    const body = Object.fromEntries(new FormData(e.currentTarget))
    const res = await fetch('/api/profile', { method: 'PATCH', body: JSON.stringify(body) })
    setSaved(res.ok ? 'Saved' : (await res.json()).error)
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="font-medium">Business details</h2>
      <p className="text-sm text-zinc-500">Used on invoices and to price proposals.</p>
      <div>
        <label className="label">Business name</label>
        <input name="business_name" className="input" defaultValue={profile.business_name ?? ''} />
      </div>
      <div>
        <label className="label">Address</label>
        <textarea name="business_address" rows={3} className="input" defaultValue={profile.business_address ?? ''} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Hourly rate</label>
          <input name="hourly_rate" type="number" min={0} className="input" defaultValue={profile.hourly_rate ?? 150} />
        </div>
        <div>
          <label className="label">Currency</label>
          <input name="currency" maxLength={3} className="input uppercase" defaultValue={profile.currency ?? 'USD'} />
        </div>
        <div>
          <label className="label">Terms (days)</label>
          <input name="payment_terms_days" type="number" min={0} className="input" defaultValue={profile.payment_terms_days ?? 14} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary">Save</button>
        <span className="text-sm text-zinc-500">{saved}</span>
      </div>
    </form>
  )
}

export function BillingCard({ plan, planName, hasCustomer }: { plan: PlanId; planName: string; hasCustomer: boolean }) {
  const [busy, setBusy] = useState(false)

  async function go(url: string, body?: object) {
    setBusy(true)
    const res = await fetch(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
    const json = await res.json()
    if (json.url) window.location.href = json.url
    else {
      alert(json.error ?? 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-medium">Plan</h2>
      <p className="text-sm">You are on <b>{planName}</b>.</p>
      <div className="flex flex-wrap gap-2">
        {plan !== 'solo' && plan !== 'pro' && (
          <button disabled={busy} onClick={() => go('/api/stripe/checkout', { plan: 'solo' })} className="btn-ghost">Solo — $39/mo</button>
        )}
        {plan !== 'pro' && (
          <button disabled={busy} onClick={() => go('/api/stripe/checkout', { plan: 'pro' })} className="btn-primary">Pro — $79/mo</button>
        )}
        {hasCustomer && (
          <button disabled={busy} onClick={() => go('/api/stripe/portal')} className="btn-ghost">Manage billing</button>
        )}
      </div>
    </div>
  )
}
