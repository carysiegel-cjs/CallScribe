import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS } from '@/lib/plans'
import { planOf, quotaMessage } from '@/lib/quota'
import { jsonError, readJson, serverError } from '@/lib/http'
import type { Profile } from '@/lib/types'

const Body = z
  .object({
    title: z.string().trim().min(1).max(200),
    clientName: z.string().trim().max(200).optional(),
    clientEmail: z.string().trim().email().optional().or(z.literal('')),
    transcript: z.string().max(400_000).optional(),
    file: z
      .object({ name: z.string().min(1).max(300), size: z.number().int().positive(), type: z.string().max(100) })
      .optional(),
  })
  .refine((b) => (b.transcript && b.transcript.trim().length > 50) || b.file, {
    message: 'Provide a recording or a transcript of at least 50 characters.',
  })

export async function POST(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return jsonError('Unauthorized', 401)

  const parsed = Body.safeParse(await readJson(req))
  if (!parsed.success) return jsonError(parsed.error.issues[0].message, 400)
  const b = parsed.data

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile) return jsonError('Profile not found. Sign out and back in.', 404)
  const planId = planOf(profile as Profile)
  const plan = PLANS[planId]

  if (b.file) {
    if (!/^(audio|video)\//.test(b.file.type)) return jsonError('Upload an audio or video file.', 400)
    if (b.file.size > plan.maxUploadMB * 1024 * 1024) {
      return jsonError(`Files up to ${plan.maxUploadMB} MB on your plan. Try exporting as M4A or MP3.`, 413)
    }
  }

  const admin = createAdminClient()
  const { data: id, error } = await admin.rpc('create_call', {
    p_user: user.id,
    p_title: b.title,
    p_client_name: b.clientName || null,
    p_client_email: b.clientEmail || null,
    p_transcript: b.file ? null : b.transcript,
    p_status: b.file ? 'uploading' : 'queued',
    p_limit: Number.isFinite(plan.callsPerMonth) ? plan.callsPerMonth : null,
    p_lifetime: plan.lifetime,
  })
  if (error?.message.includes('quota_exceeded')) return jsonError(quotaMessage(planId), 402, { upgrade: true })
  if (error || !id) return serverError('create_call', error)

  if (!b.file) return NextResponse.json({ id })

  // The server chooses the storage path; the browser gets a one-time upload URL for it.
  const safe = b.file.name.replace(/[^\w.-]+/g, '_').slice(-120)
  const path = `${user.id}/${id}/${safe}`
  const { data: upload, error: upErr } = await admin.storage.from('recordings').createSignedUploadUrl(path)
  if (upErr || !upload) return serverError('signed upload', upErr)
  await admin.from('calls').update({ audio_path: path }).eq('id', id)

  return NextResponse.json({ id, uploadUrl: upload.signedUrl })
}
