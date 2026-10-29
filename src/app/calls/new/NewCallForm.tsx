'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const ACCEPT = 'audio/*,video/*,.m4a,.mp3,.mp4,.wav,.webm,.mov'

export function NewCallForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'upload' | 'paste'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const body: Record<string, string> = {
      title: String(form.get('title')),
      clientName: String(form.get('clientName') ?? ''),
      clientEmail: String(form.get('clientEmail') ?? ''),
    }

    try {
      if (mode === 'upload') {
        if (!file) throw new Error('Choose a recording first.')
        setBusy('Uploading…')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const safe = file.name.replace(/[^\w.-]+/g, '_')
        const path = `${user!.id}/${crypto.randomUUID()}-${safe}`
        const { error } = await supabase.storage.from('recordings').upload(path, file, { contentType: file.type })
        if (error) throw new Error(error.message)
        body.audioPath = path
      } else {
        body.transcript = String(form.get('transcript') ?? '')
      }

      setBusy('Starting…')
      const res = await fetch('/api/calls', { method: 'POST', body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) {
        setError({ message: json.error, upgrade: json.upgrade })
        setBusy('')
        return
      }
      router.push(`/calls/${json.id}`)
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Something went wrong' })
      setBusy('')
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className="label" htmlFor="title">Call title</label>
          <input id="title" name="title" required className="input" placeholder="Discovery call — website redesign" />
        </div>
        <div>
          <label className="label" htmlFor="clientName">Client name</label>
          <input id="clientName" name="clientName" className="input" placeholder="Acme Inc." />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="clientEmail">Client email</label>
          <input id="clientEmail" name="clientEmail" type="email" className="input" placeholder="jane@acme.com" />
        </div>
      </div>

      <div className="flex gap-1 rounded-md bg-zinc-100 p-1 text-sm">
        {(['upload', 'paste'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded px-3 py-1.5 ${mode === m ? 'bg-white shadow-sm' : 'text-zinc-600'}`}
          >
            {m === 'upload' ? 'Upload recording' : 'Paste transcript'}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 p-10 text-center hover:border-zinc-400">
          <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <span className="font-medium">{file.name} <span className="text-zinc-500">({(file.size / 1e6).toFixed(1)} MB)</span></span>
          ) : (
            <>
              <span className="font-medium">Choose an audio or video file</span>
              <span className="mt-1 text-sm text-zinc-500">MP3, M4A, WAV, MP4, MOV, WEBM</span>
            </>
          )}
        </label>
      ) : (
        <textarea name="transcript" rows={12} className="input font-mono" placeholder="Paste the call transcript here…" required />
      )}

      {error && (
        <p className="text-sm text-red-600">
          {error.message}{' '}
          {error.upgrade && <Link href="/settings" className="underline">Upgrade</Link>}
        </p>
      )}

      <button className="btn-primary w-full" disabled={!!busy}>{busy || 'Generate proposal, tasks & invoice'}</button>
    </form>
  )
}
