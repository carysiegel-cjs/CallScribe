'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ACCEPT = 'audio/*,video/*,.m4a,.mp3,.mp4,.wav,.webm,.mov'

function upload(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error('Upload failed. Check your connection and try again.')))
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.send(file)
  })
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, json }
}

export function NewCallForm({ maxUploadMB, blockedMessage }: { maxUploadMB: number; blockedMessage: string | null }) {
  const router = useRouter()
  const [mode, setMode] = useState<'upload' | 'paste'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(
    blockedMessage ? { message: blockedMessage, upgrade: true } : null,
  )

  // Warn before leaving mid-upload.
  useEffect(() => {
    if (progress === null) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [progress])

  function pickFile(f: File | null) {
    setError(null)
    if (f && f.size > maxUploadMB * 1024 * 1024) {
      setError({ message: `That file is ${(f.size / 1e6).toFixed(0)} MB. Your plan allows ${maxUploadMB} MB. Export the audio as M4A or MP3 to shrink it.` })
      setFile(null)
      return
    }
    setFile(f)
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const base = {
      title: String(form.get('title')),
      clientName: String(form.get('clientName') ?? ''),
      clientEmail: String(form.get('clientEmail') ?? ''),
    }

    try {
      if (mode === 'upload' && !file) throw new Error('Choose a recording first.')
      setBusy('Starting…')
      // Create the call first: quota and file size are checked before any bytes are uploaded.
      const created = await post(
        '/api/calls',
        mode === 'upload'
          ? { ...base, file: { name: file!.name, size: file!.size, type: file!.type || 'audio/mpeg' } }
          : { ...base, transcript: String(form.get('transcript') ?? '') },
      )
      if (!created.ok) {
        setError({ message: created.json.error ?? 'Something went wrong', upgrade: created.json.upgrade })
        setBusy('')
        return
      }

      if (mode === 'upload') {
        setBusy('Uploading…')
        setProgress(0)
        await upload(created.json.uploadUrl, file!, setProgress)
        setBusy('Starting transcription…')
        const started = await post(`/api/calls/${created.json.id}/uploaded`)
        setProgress(null)
        if (!started.ok) throw new Error(started.json.error ?? 'Could not start transcription')
      }
      router.push(`/calls/${created.json.id}`)
    } catch (err) {
      setProgress(null)
      setError({ message: err instanceof Error ? err.message : 'Something went wrong' })
      setBusy('')
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className="label" htmlFor="title">Call title</label>
          <input id="title" name="title" required maxLength={200} className="input" placeholder="Discovery call: website redesign" />
        </div>
        <div>
          <label className="label" htmlFor="clientName">Client name</label>
          <input id="clientName" name="clientName" maxLength={200} className="input" placeholder="Acme Inc." />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="clientEmail">Client email</label>
          <input id="clientEmail" name="clientEmail" type="email" className="input" placeholder="jane@acme.com" />
        </div>
      </div>

      <div role="radiogroup" aria-label="Input type" className="flex gap-1 rounded-md bg-zinc-100 p-1 text-sm">
        {(['upload', 'paste'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${mode === m ? 'bg-white shadow-sm' : 'text-zinc-600'}`}
          >
            {m === 'upload' ? 'Upload recording' : 'Paste transcript'}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <div>
          <input id="file" type="file" accept={ACCEPT} className="peer sr-only" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          <label
            htmlFor="file"
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 p-8 text-center hover:border-zinc-400 peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900 sm:p-10"
          >
            {file ? (
              <span className="break-all font-medium">{file.name} <span className="text-zinc-500">({(file.size / 1e6).toFixed(1)} MB)</span></span>
            ) : (
              <>
                <span className="font-medium">Choose an audio or video file</span>
                <span className="mt-1 text-sm text-zinc-500">MP3, M4A, WAV, MP4, MOV, WEBM · up to {maxUploadMB} MB · first 3 hours transcribed</span>
              </>
            )}
          </label>
          {progress !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-zinc-600"><span>Uploading. Keep this page open.</span><span>{progress}%</span></div>
              <div className="mt-1 h-2 rounded-full bg-zinc-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                <div className="h-2 rounded-full bg-zinc-900 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="transcript">Transcript</label>
          <textarea id="transcript" name="transcript" rows={12} className="input font-mono" placeholder="Paste the call transcript here…" required minLength={50} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error.message}{' '}
          {error.upgrade && <Link href="/settings" className="link font-medium">See plans</Link>}
        </p>
      )}

      <button className="btn-primary w-full" disabled={!!busy || !!blockedMessage}>
        {busy || 'Generate proposal, tasks & invoice'}
      </button>
    </form>
  )
}
