import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { advance } from '@/lib/pipeline'
import { readJson } from '@/lib/http'

export const maxDuration = 300

function authorized(header: string | null) {
  const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET
  if (!secret || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  if (!authorized(req.headers.get('x-webhook-secret'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await readJson(req)) as { transcript_id?: string } | null
  if (!body?.transcript_id) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { data: call } = await createAdminClient()
    .from('calls')
    .select('id')
    .eq('assemblyai_id', body.transcript_id)
    .maybeSingle()
  // Transcribe check + generation run here, so work continues with no browser open.
  if (call) await advance(call.id)
  return NextResponse.json({ ok: true })
}
