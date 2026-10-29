import { generateOutputs } from './ai'
import { checkTranscription } from './transcribe'
import { createAdminClient } from './supabase/admin'
import type { Call, Profile } from './types'

const STALE_MS = 3 * 60 * 1000

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x.toISOString().slice(0, 10)
}

// Advances a call one step. Safe to call repeatedly / concurrently (client polls it).
export async function advance(call: Call): Promise<Call> {
  const admin = createAdminClient()

  if (call.status === 'transcribing' && call.assemblyai_id) {
    const r = await checkTranscription(call.assemblyai_id)
    if (!r.done) return call
    const patch = 'error' in r ? { status: 'error', error: r.error } : { status: 'queued', transcript: r.text }
    const { data } = await admin.from('calls').update(patch).eq('id', call.id).eq('status', 'transcribing').select().single()
    call = (data as Call) ?? call
  }

  const stale = call.status === 'generating' && Date.now() - new Date(call.updated_at).getTime() > STALE_MS
  if (call.status !== 'queued' && !stale) return call

  // Claim the job atomically so concurrent polls don't generate twice.
  let claim = admin.from('calls').update({ status: 'generating', error: null }).eq('id', call.id)
  claim = stale
    ? claim.eq('status', 'generating').lt('updated_at', new Date(Date.now() - STALE_MS).toISOString())
    : claim.eq('status', 'queued')
  const { data: claimed } = await claim.select().maybeSingle()
  if (!claimed) return call

  try {
    const { data: profile } = await admin.from('profiles').select('*').eq('id', call.user_id).single()
    const out = await generateOutputs({
      transcript: call.transcript ?? '',
      title: call.title,
      clientName: call.client_name,
      profile: profile as Profile | null,
    })
    const now = new Date()
    const invoice = {
      number: `INV-${now.toISOString().slice(0, 7).replace('-', '')}-${call.id.slice(0, 4).toUpperCase()}`,
      issue_date: now.toISOString().slice(0, 10),
      due_date: addDays(now, (profile as Profile | null)?.payment_terms_days ?? 14),
      line_items: out.invoice.line_items,
      notes: out.invoice.notes,
    }
    const { data } = await admin
      .from('calls')
      .update({ status: 'ready', summary: out.summary, proposal: out.proposal, action_items: out.action_items, invoice })
      .eq('id', call.id)
      .select()
      .single()
    return data as Call
  } catch (e) {
    const { data } = await admin
      .from('calls')
      .update({ status: 'error', error: e instanceof Error ? e.message : 'Generation failed' })
      .eq('id', call.id)
      .select()
      .single()
    return data as Call
  }
}
