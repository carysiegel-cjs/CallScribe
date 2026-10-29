'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge } from '@/components/StatusBadge'
import { date } from '@/lib/format'
import { MAX_REGENERATIONS } from '@/lib/plans'
import { PENDING_STATUSES, type Call, type CallStatus, type Profile } from '@/lib/types'
import { ActionItemsDoc, InvoiceDoc, ProposalDoc } from './docs'

const TABS = ['Proposal', 'Action items', 'Invoice', 'Transcript'] as const
type Tab = (typeof TABS)[number]
type Light = Pick<Call, 'id' | 'status' | 'error' | 'updated_at'>

const POLLED: CallStatus[] = PENDING_STATUSES.filter((s) => s !== 'uploading')

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, json }
}

function elapsed(from: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function CallView({ initial, profile }: { initial: Call; profile: Profile | null }) {
  const router = useRouter()
  const [call, setCall] = useState(initial)
  const [tab, setTab] = useState<Tab>('Proposal')
  const [editing, setEditing] = useState(false)
  const [failures, setFailures] = useState(0)
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const cur = profile?.currency ?? 'USD'
  const pending = POLLED.includes(call.status)

  // Server re-render (router.refresh) brings the full outputs once a job finishes.
  useEffect(() => setCall(initial), [initial])

  // Poll with backoff; a failed request schedules the next one instead of stopping.
  useEffect(() => {
    if (!pending) return
    let alive = true
    const base = call.status === 'transcribing' ? 5000 : 2000
    const delay = Math.min(30_000, base * 2 ** failures)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/calls/${call.id}/status`)
        if (!res.ok) throw new Error(String(res.status))
        const light = (await res.json()) as Light
        if (!alive) return
        setFailures(0)
        if (light.status !== call.status || light.updated_at !== call.updated_at) {
          setCall((c) => ({ ...c, ...light }))
          if (!POLLED.includes(light.status)) router.refresh()
        } else setTick((n) => n + 1)
      } catch {
        if (alive) setFailures((f) => f + 1)
      }
    }, delay)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [pending, call.id, call.status, call.updated_at, failures, tick, router])

  useEffect(() => {
    if (!pending) return
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [pending])

  async function regenerate() {
    if (!confirm('Regenerate all documents? Your current proposal, action items and invoice (including edits) will be replaced. Previous versions are kept in history.')) return
    setBusy(true)
    setMsg(null)
    const r = await send(`/api/calls/${call.id}/regenerate`, 'POST')
    setBusy(false)
    if (!r.ok) return setMsg({ kind: 'error', text: r.json.error ?? 'Could not regenerate' })
    setEditing(false)
    setCall({ ...call, status: 'queued', regen_count: call.regen_count + 1 })
  }

  async function remove() {
    if (!confirm('Delete this call, its transcript and documents? This cannot be undone.')) return
    setBusy(true)
    const r = await send(`/api/calls/${call.id}`, 'DELETE')
    if (!r.ok) {
      setBusy(false)
      return setMsg({ kind: 'error', text: r.json.error ?? 'Could not delete this call' })
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function save(patch: object) {
    setMsg(null)
    const r = await send(`/api/calls/${call.id}`, 'PATCH', patch)
    if (!r.ok) {
      setMsg({ kind: 'error', text: r.json.error ?? 'Could not save' })
      return false
    }
    setCall(r.json as Call)
    setEditing(false)
    setMsg({ kind: 'ok', text: 'Saved' })
    return true
  }

  const docProps = { call, profile, cur, editing, onSave: save, onCancel: () => setEditing(false) }
  const regensLeft = MAX_REGENERATIONS - call.regen_count

  return (
    <div>
      {/* Shown only on paper/PDF */}
      <div className="mb-6 hidden border-b border-zinc-300 pb-3 text-sm print:block">
        <b>{profile?.business_name || 'Your business'}</b>
        {profile?.email && <span className="text-zinc-600"> · {profile.email}</span>}
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-words text-2xl font-semibold">{call.title}</h1>
            <StatusBadge status={call.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">{call.client_name || 'No client'} · {date(call.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {call.status === 'ready' && !editing && tab !== 'Transcript' && (
            <button onClick={() => setEditing(true)} className="btn-ghost">Edit {tab.toLowerCase()}</button>
          )}
          {(call.status === 'ready' || call.status === 'error') && call.transcript && regensLeft > 0 && (
            <button onClick={regenerate} disabled={busy} className="btn-ghost" title={`${regensLeft} left for this call`}>
              Regenerate ({regensLeft} left)
            </button>
          )}
          <button onClick={remove} disabled={busy} className="btn-danger">Delete</button>
        </div>
      </div>

      {msg && (
        <p role={msg.kind === 'error' ? 'alert' : 'status'} className={`mb-4 text-sm print:hidden ${msg.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
          {msg.text}
        </p>
      )}

      {pending && (
        <div className="card p-8 text-center sm:p-12" aria-live="polite">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" aria-hidden />
          <p className="mt-4 font-medium">
            {call.status === 'transcribing' ? 'Transcribing your recording…' : 'Writing your proposal, tasks and invoice…'}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {call.status === 'transcribing'
              ? 'Usually 15–30% of the recording length (about 10 minutes for a 1-hour call).'
              : 'Usually under a minute.'}{' '}
            Elapsed {elapsed(call.updated_at, now)}.
          </p>
          <p className="mt-3 text-sm text-zinc-600">You can leave this page. Processing continues and the call will be ready in your Calls list.</p>
          {failures >= 3 && (
            <p role="alert" className="mt-4 text-sm text-amber-800">
              Having trouble reaching the server. Still retrying…{' '}
              <button className="link font-medium" onClick={() => setFailures(0)}>Retry now</button>
            </p>
          )}
        </div>
      )}

      {call.status === 'uploading' && (
        <div className="card p-6 text-sm">
          <p className="font-medium">This upload didn't finish.</p>
          <p className="mt-1 text-zinc-600">
            Delete this call and <Link href="/calls/new" className="link">start a new one</Link>. Because it never finished, it won't count against your allowance.
          </p>
        </div>
      )}

      {call.status === 'error' && (
        <div role="alert" className="card border-red-200 p-6 text-sm text-red-800">{call.error || 'Something went wrong.'}</div>
      )}

      {call.status === 'ready' && (
        <>
          <p className="mb-4 rounded-md bg-zinc-100 px-4 py-2 text-xs text-zinc-600 print:hidden">
            AI-drafted from your call. Review prices, dates and scope before sending.
          </p>
          {call.summary && <p className="card mb-6 p-5 text-sm leading-relaxed text-zinc-700 print:hidden">{call.summary}</p>}
          <div role="tablist" aria-label="Documents" className="mb-4 flex gap-1 overflow-x-auto border-b border-zinc-200 print:hidden">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                id={`tab-${t}`}
                aria-selected={tab === t}
                aria-controls="tabpanel"
                disabled={editing && tab !== t}
                onClick={() => setTab(t)}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-40 ${tab === t ? 'border-zinc-900 font-medium' : 'border-transparent text-zinc-600'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div id="tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="card p-4 sm:p-8 print:border-0 print:p-0">
            {tab === 'Proposal' && <ProposalDoc {...docProps} />}
            {tab === 'Action items' && <ActionItemsDoc {...docProps} />}
            {tab === 'Invoice' && <InvoiceDoc {...docProps} />}
            {tab === 'Transcript' && <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{call.transcript}</pre>}
          </div>
        </>
      )}

      {call.status === 'error' && call.transcript && (
        <details className="card mt-4 p-5 text-sm">
          <summary className="cursor-pointer font-medium">Transcript</summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans">{call.transcript}</pre>
        </details>
      )}
    </div>
  )
}
