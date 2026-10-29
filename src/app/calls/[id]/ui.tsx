'use client'

import { useState } from 'react'
import { money, total } from '@/lib/format'
import type { LineItem } from '@/lib/types'

export function CopyButton({ text, label = 'Copy text' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      <span aria-live="polite">{done ? 'Copied' : label}</span>
    </button>
  )
}

// mailto bodies get truncated by many mail clients past ~2k chars.
const MAILTO_LIMIT = 1800

export function EmailButton({ to, subject, text, label }: { to: string | null; subject: string; text: string; label: string }) {
  const [note, setNote] = useState('')
  async function send() {
    let body = text
    if (text.length > MAILTO_LIMIT) {
      await navigator.clipboard.writeText(text)
      body = 'Hi,\n\n[Full text copied to your clipboard. Paste it here or attach the PDF.]\n'
      setNote('Full text copied. Paste it into the email or attach the downloaded PDF.')
    }
    window.location.href = `mailto:${to ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  return (
    <>
      <button type="button" className="btn-ghost" onClick={send}>{label}</button>
      {note && <p role="status" className="basis-full text-xs text-zinc-600">{note}</p>}
    </>
  )
}

export function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn-ghost" onClick={() => window.print()}>{label}</button>
}

export function ItemsTable({ items, cur }: { items: LineItem[]; cur: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500">
            <th scope="col" className="py-2 font-medium">Description</th>
            <th scope="col" className="py-2 text-right font-medium">Qty</th>
            <th scope="col" className="py-2 text-right font-medium">Rate</th>
            <th scope="col" className="py-2 text-right font-medium">Amount</th>
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
    </div>
  )
}

export function LineItemsEditor({ items, onChange, cur, idPrefix }: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  cur: string
  idPrefix: string
}) {
  const set = (n: number, patch: Partial<LineItem>) => onChange(items.map((it, i) => (i === n ? { ...it, ...patch } : it)))
  return (
    <div className="space-y-2">
      {items.map((it, n) => (
        <fieldset key={n} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-zinc-200 p-2 sm:grid-cols-[1fr_5rem_7rem_auto]">
          <legend className="sr-only">Line item {n + 1}</legend>
          <label className="col-span-2 sm:col-span-1">
            <span className="sr-only">Description</span>
            <input className="input" value={it.description} placeholder="Description" onChange={(e) => set(n, { description: e.target.value })} id={`${idPrefix}-d-${n}`} />
          </label>
          <label>
            <span className="text-xs text-zinc-500 sm:sr-only">Qty</span>
            <input className="input" type="number" min={0} step="any" value={it.quantity} onChange={(e) => set(n, { quantity: Number(e.target.value) })} />
          </label>
          <label>
            <span className="text-xs text-zinc-500 sm:sr-only">Rate ({cur})</span>
            <input className="input" type="number" min={0} step="any" value={it.unit_price} onChange={(e) => set(n, { unit_price: Number(e.target.value) })} />
          </label>
          <button type="button" className="btn-danger self-end px-3" aria-label={`Remove line item ${n + 1}`} onClick={() => onChange(items.filter((_, i) => i !== n))}>✕</button>
        </fieldset>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost" onClick={() => onChange([...items, { description: '', quantity: 1, unit_price: 0 }])}>Add line</button>
        <span className="text-sm font-medium">Total {money(total(items), cur)}</span>
      </div>
    </div>
  )
}

export function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
    </div>
  )
}
