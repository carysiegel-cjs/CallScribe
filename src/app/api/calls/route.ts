import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/server'
import { checkQuota } from '@/lib/quota'
import { startTranscription } from '@/lib/transcribe'
import type { Profile } from '@/lib/types'

const Body = z
  .object({
    title: z.string().min(1).max(200),
    clientName: z.string().max(200).optional(),
    clientEmail: z.string().email().optional().or(z.literal('')),
    transcript: z.string().max(400_000).optional(),
    audioPath: z.string().optional(),
  })
  .refine((b) => (b.transcript && b.transcript.trim().length > 50) || b.audioPath, {
    message: 'Provide a recording or a transcript of at least 50 characters.',
  })

export async function POST(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const b = parsed.data

  if (b.audioPath && !b.audioPath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const quota = await checkQuota(supabase, profile as Profile)
  if (!quota.ok) return NextResponse.json({ error: quota.message, upgrade: true }, { status: 402 })

  let assemblyaiId: string | null = null
  if (b.audioPath) {
    try {
      assemblyaiId = await startTranscription(b.audioPath)
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Transcription failed' }, { status: 502 })
    }
  }

  const { data, error } = await supabase
    .from('calls')
    .insert({
      user_id: user.id,
      title: b.title,
      client_name: b.clientName || null,
      client_email: b.clientEmail || null,
      transcript: b.audioPath ? null : b.transcript,
      audio_path: b.audioPath ?? null,
      assemblyai_id: assemblyaiId,
      status: b.audioPath ? 'transcribing' : 'queued',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
