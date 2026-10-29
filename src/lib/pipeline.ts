import { MODEL, RetryableError, generateOutputs } from './ai'
import { total } from './format'
import { checkTranscription, deleteTranscription, type TranscriptionResult } from './transcribe'
import { createAdminClient } from './supabase/admin'
import type { Call, Profile } from './types'

// Longer than the status route's maxDuration (300s) so a live run is never reclaimed.
const STALE_SECONDS = 360
const MAX_ATTEMPTS = 3

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}

async function deleteAudio(call: Pick<Call, 'id' | 'audio_path'>) {
  if (!call.audio_path) return
  const admin = createAdminClient()
  const { error } = await admin.storage.from('recordings').remove([call.audio_path])
  if (error) return console.error('[delete audio]', call.id, error)
  await admin.from('calls').update({ audio_deleted_at: new Date().toISOString() }).eq('id', call.id)
}

// Advances a call one step. Idempotent and safe to run concurrently from the
// status poll, the AssemblyAI webhook and the cron sweeper.
export async function advance(id: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin.from('calls').select('*').eq('id', id).maybeSingle()
  if (!data) return
  let call = data as Call

  if (call.status === 'transcribing' && call.assemblyai_id) {
    let r: TranscriptionResult
    try {
      r = await checkTranscription(call.assemblyai_id)
    } catch (e) {
      console.error('[transcription check]', id, e)
      return
    }
    if (!r.done) return
    if ('error' in r) {
      await admin.from('calls').update({ status: 'error', error: r.error }).eq('id', id).eq('status', 'transcribing')
      await deleteAudio(call)
      return
    }
    const { data: updated } = await admin
      .from('calls')
      .update({ status: 'queued', transcript: r.text })
      .eq('id', id)
      .eq('status', 'transcribing')
      .select()
      .maybeSingle()
    if (!updated) return
    call = updated as Call
    await Promise.all([deleteAudio(call), deleteTranscription(call.assemblyai_id!)])
  }

  if (call.status !== 'queued' && call.status !== 'generating') return

  const { data: claimed, error } = await admin.rpc('claim_call', {
    p_id: id,
    p_stale_seconds: STALE_SECONDS,
    p_max_attempts: MAX_ATTEMPTS,
  })
  if (error) return console.error('[claim]', id, error)
  const job = (claimed as Call[] | null)?.[0]
  if (job) await generate(job)
}

async function generate(call: Call) {
  const admin = createAdminClient()
  // Every write is conditioned on our claim so a superseded run can't overwrite a newer one.
  const mine = (q: ReturnType<ReturnType<typeof admin.from>['update']>) =>
    q.eq('id', call.id).eq('claim_token', call.claim_token!).eq('status', 'generating')

  try {
    const { data: profile } = await admin.from('profiles').select('*').eq('id', call.user_id).single()
    const p = profile as Profile | null
    const out = await generateOutputs({
      transcript: call.transcript ?? '',
      title: call.title,
      clientName: call.client_name,
      profile: p,
    })

    let number = call.invoice_number
    if (number == null) {
      const { data: n, error } = await admin.rpc('next_invoice_number', { p_user: call.user_id })
      if (error) throw error
      number = n as number
    }
    const now = new Date()
    const invoice = {
      number: `INV-${String(number).padStart(4, '0')}`,
      issue_date: now.toISOString().slice(0, 10),
      due_date: addDays(now, p?.payment_terms_days ?? 14),
      line_items: out.invoice.line_items,
      notes: out.invoice.notes,
    }

    const { data: saved } = await mine(
      admin.from('calls').update({
        status: 'ready',
        summary: out.summary,
        proposal: out.proposal,
        action_items: out.action_items,
        invoice,
        invoice_number: number,
        amount_total: total(out.proposal.pricing),
        claim_token: null,
        next_attempt_at: null,
      }),
    )
      .select('id')
      .maybeSingle()

    if (saved) {
      await admin.from('call_outputs').insert({
        call_id: call.id,
        user_id: call.user_id,
        source: 'generate',
        summary: out.summary,
        proposal: out.proposal,
        action_items: out.action_items,
        invoice,
        model: MODEL,
      })
    }
  } catch (e) {
    console.error('[generate]', call.id, e)
    if (e instanceof RetryableError && call.attempts < MAX_ATTEMPTS) {
      await mine(
        admin.from('calls').update({
          status: 'queued',
          next_attempt_at: new Date(Date.now() + 30_000 * call.attempts).toISOString(),
        }),
      )
    } else {
      await mine(
        admin.from('calls').update({
          status: 'error',
          error: "We couldn't generate documents for this call. Try Regenerate.",
        }),
      )
    }
  }
}

// Picks up work nobody is polling for: missed webhooks, retries, stale jobs, abandoned uploads.
export async function sweep(limit = 5) {
  const admin = createAdminClient()
  const now = Date.now()

  const { data: abandoned } = await admin
    .from('calls')
    .select('id,user_id')
    .eq('status', 'uploading')
    .lt('updated_at', new Date(now - 3 * 60 * 60 * 1000).toISOString())
  for (const c of abandoned ?? []) {
    await admin.from('calls').update({ status: 'error', error: 'Upload was not completed.' }).eq('id', c.id).eq('status', 'uploading')
    // Refund: an upload that never finished shouldn't use up a call.
    await admin.from('usage_events').delete().eq('call_id', c.id).eq('kind', 'call')
  }

  const { data: pending } = await admin
    .from('calls')
    .select('id')
    .or(
      [
        `and(status.eq.transcribing,updated_at.lt.${new Date(now - 60_000).toISOString()})`,
        `and(status.eq.queued,or(next_attempt_at.is.null,next_attempt_at.lte.${new Date(now).toISOString()}))`,
        `and(status.eq.generating,updated_at.lt.${new Date(now - STALE_SECONDS * 1000).toISOString()})`,
      ].join(','),
    )
    .order('updated_at', { ascending: true })
    .limit(limit)

  await Promise.all((pending ?? []).map((c) => advance(c.id)))
  return { abandoned: abandoned?.length ?? 0, advanced: pending?.length ?? 0 }
}
