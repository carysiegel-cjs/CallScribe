'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/StatusBadge'
import { date, money, total } from '@/lib/format'
import type { Call, LineItem, Profile } from '@/lib/types'

const TABS = ['Proposal', 'Action items', 'Invoice', 'Transcript'] as const
type Tab = (typeof TABS)[number]
const PENDING = ['transcribing', 'queued', 'generating']

export function CallView({ initial, profile }: { initial: Call; profile: Profile }) {
  const router = useRouter()
  const [call, setCall] = useState(initial)
  const [tab, setTab] = useState<Tab>('Proposal')
  const cur = profile?.currency ?? 'USD'

  useEffect(() => {
    if (!PENDING.includes(call.status)) return
    let alive = true
    const tick = async () => {
      const res = await fetch(`/api/calls/${call.id}/status`)
      if (alive && res.ok) setCall(await res.json())
    }
    const t = setTimeout(tick, call.status === 'transcribing' ? 5000 : 1500)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [call])

  async function regenerate() {
    const res = await fetch(`/api/calls/${call.id}/regenerate`, { method: 'POST' })
    if (res.ok) setCall({ ...call, status: 'queued' })
  }

  async function remove() {
    if (!confirm('Delete this call and its recording?')) return
    await fetch(`/api/calls/${call.id}`, { method: 'DELETE' })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{call.title}</h1>
            <StatusBadge status={call.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">{call.client_name || 'No client'} · {date(call.created_at)}</p>
        </div>
        <div className="flex gap-2">
          {call.status === 'ready' && <button onClick={() => window.print()} className="btn-ghost">Print / PDF</button>}
          {(call.status === 'ready' || call.status === 'error') && call.transcript && (
            <button onClick={regenerate} className="btn-ghost">Regenerate</button>
          )}
          <button onClick={remove} className="btn-ghost text-red-600">Delete</button>
        </div>
      </div>

      {PENDING.includes(call.status) && (
        <div className="card p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
          <p className="mt-4 font-medium">
            {call.status === 'transcribing' ? 'Transcribing your recording…' : 'Writing your proposal, tasks and invoice…'}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {call.status === 'transcribing' ? 'Usually about 15–30% of the recording length.' : 'Usually under a minute.'}
          </p>
        </div>
      )}

      {call.status === 'error' && (
        <div className="card border-red-200 p-6 text-sm text-red-700">{call.error || 'Something went wrong.'}</div>
      )}

      {call.status === 'ready' && (
        <>
          {call.summary && <p className="card mb-6 p-5 text-sm leading-relaxed text-zinc-700 print:hidden">{call.summary}</p>}
          <div className="mb-4 flex gap-1 border-b border-zinc-200 print:hidden">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t ? 'border-zinc-900 font-medium' : 'border-transparent text-zinc-500'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="card p-8 print:border-0 print:p-0">
            {tab === 'Proposal' && <ProposalDoc call={call} profile={profile} cur={cur} />}
            {tab === 'Action items' && <ActionItems call={call} />}
            {tab === 'Invoice' && <InvoiceDoc call={call} profile={profile} cur={cur} />}
            {tab === 'Transcript' && <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{call.transcript}</pre>}
          </div>
        </>
      )}

      {call.status !== 'ready' && call.transcript && call.status === 'error' && (
        <details className="card mt-4 p-5 text-sm">
          <summary className="cursor-pointer font-medium">Transcript</summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans">{call.transcript}</pre>
        </details>
      )}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn-ghost print:hidden"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? 'Copied' : 'Copy as text'}
    </button>
  )
}

function Items({ items, cur }: { items: LineItem[]; cur: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-zinc-500">
          <th className="py-2 font-medium">Description</th>
          <th className="py-2 text-right font-medium">Qty</th>
          <th className="py-2 text-right font-medium">Rate</th>
          <th className="py-2 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i, n) => (
          <tr key={n} className="border-b border-zinc-100">
            <td className="py-2 pr-4">{i.description}</td>
            <td className="py-2 text-right">{i.quantity}</td>
            <td className="py-2 text-right">{money(i.unit_price, cur)}</td>
            <td className="py-2 text-right">{money(i.quantity * i.unit_price, cur)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} className="py-3 text-right font-medium">Total</td>
          <td className="py-3 text-right text-base font-semibold">{money(total(items), cur)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function proposalText(call: Call, cur: string) {
  const p = call.proposal!
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n')
  return [
    p.title,
    `\n${p.overview}`,
    `\nObjectives\n${list(p.objectives)}`,
    `\nScope\n${list(p.scope)}`,
    p.out_of_scope.length ? `\nOut of scope\n${list(p.out_of_scope)}` : '',
    `\nDeliverables\n${list(p.deliverables.map((d) => `${d.name}: ${d.description}`))}`,
    `\nTimeline\n${list(p.timeline.map((t) => `${t.phase} — ${t.duration}`))}`,
    `\nInvestment\n${list(p.pricing.map((i) => `${i.description}: ${money(i.quantity * i.unit_price, cur)}`))}\nTotal: ${money(total(p.pricing), cur)}`,
    `\nTerms\n${p.terms}`,
  ].join('\n')
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  )
}

function ProposalDoc({ call, profile, cur }: { call: Call; profile: Profile; cur: string }) {
  const p = call.proposal
  if (!p) return null
  const ul = (xs: string[]) => <ul className="list-disc space-y-1 pl-5 text-sm">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul>
  return (
    <article>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Proposal for {call.client_name || 'Client'} · from {profile?.business_name || 'Me'}</p>
          <h2 className="mt-1 text-2xl font-semibold">{p.title}</h2>
        </div>
        <CopyButton text={proposalText(call, cur)} />
      </div>
      <p className="mt-4 text-sm leading-relaxed">{p.overview}</p>
      <Section title="Objectives">{ul(p.objectives)}</Section>
      <Section title="Scope">{ul(p.scope)}</Section>
      {p.out_of_scope.length > 0 && <Section title="Out of scope">{ul(p.out_of_scope)}</Section>}
      <Section title="Deliverables">
        <dl className="space-y-2 text-sm">
          {p.deliverables.map((d, i) => (
            <div key={i}><dt className="font-medium">{d.name}</dt><dd className="text-zinc-600">{d.description}</dd></div>
          ))}
        </dl>
      </Section>
      <Section title="Timeline">
        <ul className="space-y-1 text-sm">
          {p.timeline.map((t, i) => <li key={i} className="flex justify-between"><span>{t.phase}</span><span className="text-zinc-500">{t.duration}</span></li>)}
        </ul>
      </Section>
      <Section title="Investment"><Items items={p.pricing} cur={cur} /></Section>
      <Section title="Terms"><p className="text-sm leading-relaxed">{p.terms}</p></Section>
    </article>
  )
}

function ActionItems({ call }: { call: Call }) {
  const items = call.action_items ?? []
  const text = items.map((a) => `- [ ] ${a.task} (${a.owner}${a.due ? `, due ${a.due}` : ''})`).join('\n')
  const pr = { high: 'text-red-600', medium: 'text-amber-600', low: 'text-zinc-500' }
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Next steps</h2>
        <CopyButton text={text} />
      </div>
      <ul className="divide-y divide-zinc-100">
        {items.map((a, i) => (
          <li key={i} className="flex items-start gap-3 py-3 text-sm">
            <input type="checkbox" className="mt-0.5" />
            <div className="flex-1">
              <p>{a.task}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {a.owner === 'me' ? 'You' : a.owner === 'client' ? 'Client' : a.owner}
                {a.due && ` · due ${a.due}`} · <span className={pr[a.priority]}>{a.priority}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function InvoiceDoc({ call, profile, cur }: { call: Call; profile: Profile; cur: string }) {
  const inv = call.invoice
  if (!inv) return null
  const text = [
    `Invoice ${inv.number}`,
    `Issued ${inv.issue_date} · Due ${inv.due_date}`,
    `Bill to: ${call.client_name ?? ''} ${call.client_email ?? ''}`,
    ...inv.line_items.map((i) => `${i.description} — ${i.quantity} × ${money(i.unit_price, cur)} = ${money(i.quantity * i.unit_price, cur)}`),
    `Total due: ${money(total(inv.line_items), cur)}`,
    inv.notes,
  ].join('\n')
  return (
    <article>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Invoice</h2>
          <p className="text-sm text-zinc-500">{inv.number}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{profile?.business_name || 'Your business'}</p>
          <p className="whitespace-pre-line text-zinc-500">{profile?.business_address}</p>
          <p className="text-zinc-500">{profile?.email}</p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
        <div><p className="text-zinc-500">Bill to</p><p className="font-medium">{call.client_name || '—'}</p><p>{call.client_email}</p></div>
        <div><p className="text-zinc-500">Issued</p><p>{date(inv.issue_date)}</p></div>
        <div><p className="text-zinc-500">Due</p><p>{date(inv.due_date)}</p></div>
      </div>
      <div className="mt-8"><Items items={inv.line_items} cur={cur} /></div>
      {inv.notes && <p className="mt-6 text-sm text-zinc-600">{inv.notes}</p>}
      <div className="mt-6 flex gap-2 print:hidden">
        <CopyButton text={text} />
        {call.client_email && (
          <a
            className="btn-ghost"
            href={`mailto:${call.client_email}?subject=${encodeURIComponent(`Invoice ${inv.number}`)}&body=${encodeURIComponent(text)}`}
          >
            Email to client
          </a>
        )}
      </div>
    </article>
  )
}
