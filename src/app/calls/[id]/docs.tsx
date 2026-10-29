'use client'

import { useState } from 'react'
import { date, money, total } from '@/lib/format'
import type { ActionItem, Call, Invoice, Proposal, Profile } from '@/lib/types'
import { CopyButton, EmailButton, Field, ItemsTable, LineItemsEditor, PrintButton } from './ui'

type DocProps = { call: Call; profile: Profile | null; cur: string; editing: boolean; onSave: (patch: object) => Promise<boolean>; onCancel: () => void }

const lines = (xs: string[]) => xs.join('\n')
const unlines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  )
}

function SaveBar({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-zinc-200 bg-white py-3">
      <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
      <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
    </div>
  )
}

function useSave(onSave: DocProps['onSave']) {
  const [saving, setSaving] = useState(false)
  return {
    saving,
    run: async (patch: object) => {
      setSaving(true)
      await onSave(patch)
      setSaving(false)
    },
  }
}

// ----- Proposal ------------------------------------------------------------

export function proposalText(call: Call, cur: string) {
  const p = call.proposal!
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n')
  return [
    p.title,
    `\n${p.overview}`,
    `\nObjectives\n${list(p.objectives)}`,
    `\nScope\n${list(p.scope)}`,
    p.out_of_scope.length ? `\nOut of scope\n${list(p.out_of_scope)}` : '',
    `\nDeliverables\n${list(p.deliverables.map((d) => `${d.name}: ${d.description}`))}`,
    `\nTimeline\n${list(p.timeline.map((t) => `${t.phase}: ${t.duration}`))}`,
    `\nInvestment\n${list(p.pricing.map((i) => `${i.description}: ${money(i.quantity * i.unit_price, cur)}`))}\nTotal: ${money(total(p.pricing), cur)}`,
    `\nTerms\n${p.terms}`,
  ].join('\n')
}

export function ProposalDoc(props: DocProps) {
  const { call, profile, cur, editing } = props
  const p = call.proposal
  if (!p) return null
  if (editing) return <ProposalEditor {...props} proposal={p} />

  const ul = (xs: string[]) => <ul className="list-disc space-y-1 pl-5 text-sm">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul>
  return (
    <article>
      <p className="text-sm text-zinc-500">Proposal for {call.client_name || 'Client'} · from {profile?.business_name || 'Your business'}</p>
      <h2 className="mt-1 text-2xl font-semibold">{p.title}</h2>
      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{p.overview}</p>
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
          {p.timeline.map((t, i) => <li key={i} className="flex justify-between gap-4"><span>{t.phase}</span><span className="shrink-0 text-zinc-500">{t.duration}</span></li>)}
        </ul>
      </Section>
      <Section title="Investment"><ItemsTable items={p.pricing} cur={cur} /></Section>
      <Section title="Terms"><p className="whitespace-pre-line text-sm leading-relaxed">{p.terms}</p></Section>
      <div className="mt-8 flex flex-wrap gap-2 print:hidden">
        <PrintButton label="Download proposal PDF" />
        <EmailButton to={call.client_email} subject={p.title} text={proposalText(call, cur)} label="Email proposal" />
        <CopyButton text={proposalText(call, cur)} />
      </div>
    </article>
  )
}

function ProposalEditor({ proposal, cur, onSave, onCancel }: DocProps & { proposal: Proposal }) {
  const [p, setP] = useState(proposal)
  const [deliverables, setDeliverables] = useState(lines(proposal.deliverables.map((d) => `${d.name}: ${d.description}`)))
  const [timeline, setTimeline] = useState(lines(proposal.timeline.map((t) => `${t.phase}: ${t.duration}`)))
  const { saving, run } = useSave(onSave)
  const split = (s: string, key: [string, string]) =>
    unlines(s).map((l) => {
      const i = l.indexOf(':')
      return i === -1 ? { [key[0]]: l, [key[1]]: '' } : { [key[0]]: l.slice(0, i).trim(), [key[1]]: l.slice(i + 1).trim() }
    })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        run({
          proposal: {
            ...p,
            objectives: p.objectives.map((x) => x.trim()).filter(Boolean),
            scope: p.scope.map((x) => x.trim()).filter(Boolean),
            out_of_scope: p.out_of_scope.map((x) => x.trim()).filter(Boolean),
            pricing: p.pricing.filter((i) => i.description.trim()),
            deliverables: split(deliverables, ['name', 'description']),
            timeline: split(timeline, ['phase', 'duration']),
          },
        })
      }}
    >
      <Field id="p-title" label="Title"><input id="p-title" className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} required /></Field>
      <Field id="p-overview" label="Overview"><textarea id="p-overview" rows={5} className="input" value={p.overview} onChange={(e) => setP({ ...p, overview: e.target.value })} /></Field>
      {(['objectives', 'scope', 'out_of_scope'] as const).map((k) => (
        <Field key={k} id={`p-${k}`} label={`${k === 'out_of_scope' ? 'Out of scope' : k[0].toUpperCase() + k.slice(1)} (one per line)`}>
          <textarea id={`p-${k}`} rows={4} className="input" value={lines(p[k])} onChange={(e) => setP({ ...p, [k]: e.target.value.split('\n') })} />
        </Field>
      ))}
      <Field id="p-deliv" label="Deliverables (Name: description, one per line)"><textarea id="p-deliv" rows={4} className="input" value={deliverables} onChange={(e) => setDeliverables(e.target.value)} /></Field>
      <Field id="p-time" label="Timeline (Phase: duration, one per line)"><textarea id="p-time" rows={3} className="input" value={timeline} onChange={(e) => setTimeline(e.target.value)} /></Field>
      <div>
        <p className="label">Pricing</p>
        <LineItemsEditor idPrefix="pp" items={p.pricing} cur={cur} onChange={(pricing) => setP({ ...p, pricing })} />
      </div>
      <Field id="p-terms" label="Terms"><textarea id="p-terms" rows={4} className="input" value={p.terms} onChange={(e) => setP({ ...p, terms: e.target.value })} /></Field>
      <SaveBar saving={saving} onCancel={onCancel} />
    </form>
  )
}

// ----- Action items --------------------------------------------------------

export function ActionItemsDoc(props: DocProps) {
  const { call, editing } = props
  const items = call.action_items ?? []
  if (editing) return <ActionItemsEditor {...props} items={items} />
  const text = items.map((a) => `- [ ] ${a.task} (${a.owner}${a.due ? `, due ${a.due}` : ''})`).join('\n')
  const pr = { high: 'text-red-700', medium: 'text-amber-700', low: 'text-zinc-500' }
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Next steps</h2>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No action items were found in this call.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((a, i) => (
            <li key={i} className="flex items-start gap-3 py-3 text-sm">
              <input id={`ai-${i}`} type="checkbox" className="mt-0.5 h-4 w-4" />
              <label htmlFor={`ai-${i}`} className="flex-1">
                <span className="block">{a.task}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {a.owner === 'me' ? 'You' : a.owner === 'client' ? 'Client' : a.owner}
                  {a.due && ` · due ${a.due}`} · <span className={pr[a.priority]}>{a.priority} priority</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        <PrintButton label="Download PDF" />
        <EmailButton to={call.client_email} subject={`Next steps: ${call.title}`} text={text} label="Email next steps" />
        <CopyButton text={text} />
      </div>
    </div>
  )
}

function ActionItemsEditor({ items: initial, onSave, onCancel }: DocProps & { items: ActionItem[] }) {
  const [items, setItems] = useState(initial)
  const { saving, run } = useSave(onSave)
  const set = (n: number, patch: Partial<ActionItem>) => setItems(items.map((it, i) => (i === n ? { ...it, ...patch } : it)))
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run({ action_items: items.filter((i) => i.task.trim()) }) }}>
      {items.map((a, n) => (
        <fieldset key={n} className="grid gap-2 rounded-md border border-zinc-200 p-2 sm:grid-cols-[1fr_8rem_8rem_7rem_auto]">
          <legend className="sr-only">Action item {n + 1}</legend>
          <label><span className="sr-only">Task</span><input className="input" value={a.task} placeholder="Task" onChange={(e) => set(n, { task: e.target.value })} /></label>
          <label><span className="sr-only">Owner</span><input className="input" value={a.owner} placeholder="Owner" onChange={(e) => set(n, { owner: e.target.value })} /></label>
          <label><span className="sr-only">Due</span><input className="input" value={a.due ?? ''} placeholder="Due" onChange={(e) => set(n, { due: e.target.value || null })} /></label>
          <label>
            <span className="sr-only">Priority</span>
            <select className="input" value={a.priority} onChange={(e) => set(n, { priority: e.target.value as ActionItem['priority'] })}>
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </label>
          <button type="button" className="btn-danger px-3" aria-label={`Remove action item ${n + 1}`} onClick={() => setItems(items.filter((_, i) => i !== n))}>✕</button>
        </fieldset>
      ))}
      <button type="button" className="btn-ghost" onClick={() => setItems([...items, { task: '', owner: 'me', due: null, priority: 'medium' }])}>Add item</button>
      <SaveBar saving={saving} onCancel={onCancel} />
    </form>
  )
}

// ----- Invoice -------------------------------------------------------------

export function invoiceText(call: Call, inv: Invoice, cur: string, profile: Profile | null) {
  return [
    `Invoice ${inv.number}${profile?.business_name ? ` from ${profile.business_name}` : ''}`,
    `Issued ${inv.issue_date} · Due ${inv.due_date}`,
    `Bill to: ${[call.client_name, call.client_email].filter(Boolean).join(' ')}`,
    '',
    ...inv.line_items.map((i) => `${i.description}: ${i.quantity} × ${money(i.unit_price, cur)} = ${money(i.quantity * i.unit_price, cur)}`),
    '',
    `Total due: ${money(total(inv.line_items), cur)}`,
    inv.notes,
  ].join('\n')
}

export function InvoiceDoc(props: DocProps) {
  const { call, profile, cur, editing } = props
  const inv = call.invoice
  if (!inv) return null
  if (editing) return <InvoiceEditor {...props} invoice={inv} />
  const text = invoiceText(call, inv, cur, profile)
  return (
    <article>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-2xl font-semibold">Invoice</h2>
          <p className="text-sm text-zinc-500">{inv.number}</p>
        </div>
        <div className="text-sm sm:text-right">
          <p className="font-medium">{profile?.business_name || 'Your business'}</p>
          <p className="whitespace-pre-line text-zinc-500">{profile?.business_address}</p>
          <p className="text-zinc-500">{profile?.email}</p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
        <div><p className="text-zinc-500">Bill to</p><p className="font-medium">{call.client_name || '—'}</p><p className="break-all">{call.client_email}</p></div>
        <div><p className="text-zinc-500">Issued</p><p>{date(inv.issue_date)}</p></div>
        <div><p className="text-zinc-500">Due</p><p>{date(inv.due_date)}</p></div>
      </div>
      <div className="mt-8"><ItemsTable items={inv.line_items} cur={cur} /></div>
      {inv.notes && <p className="mt-6 whitespace-pre-line text-sm text-zinc-600">{inv.notes}</p>}
      <div className="mt-8 flex flex-wrap gap-2 print:hidden">
        <PrintButton label="Download invoice PDF" />
        <EmailButton to={call.client_email} subject={`Invoice ${inv.number}`} text={text} label="Email invoice" />
        <CopyButton text={text} />
      </div>
    </article>
  )
}

function InvoiceEditor({ invoice, cur, onSave, onCancel }: DocProps & { invoice: Invoice }) {
  const [inv, setInv] = useState(invoice)
  const { saving, run } = useSave(onSave)
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const { number: _n, ...rest } = inv; run({ invoice: { ...rest, line_items: rest.line_items.filter((i) => i.description.trim()) } }) }}>
      <p className="text-sm text-zinc-500">Invoice {inv.number} (number can't be changed)</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="i-issue" label="Issue date"><input id="i-issue" type="date" className="input" value={inv.issue_date} onChange={(e) => setInv({ ...inv, issue_date: e.target.value })} required /></Field>
        <Field id="i-due" label="Due date"><input id="i-due" type="date" className="input" value={inv.due_date} onChange={(e) => setInv({ ...inv, due_date: e.target.value })} required /></Field>
      </div>
      <div>
        <p className="label">Line items</p>
        <LineItemsEditor idPrefix="ii" items={inv.line_items} cur={cur} onChange={(line_items) => setInv({ ...inv, line_items })} />
      </div>
      <Field id="i-notes" label="Notes (payment instructions, thanks, etc.)"><textarea id="i-notes" rows={3} className="input" value={inv.notes} onChange={(e) => setInv({ ...inv, notes: e.target.value })} /></Field>
      <SaveBar saving={saving} onCancel={onCancel} />
    </form>
  )
}
