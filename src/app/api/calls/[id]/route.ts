import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteTranscription } from '@/lib/transcribe'
import { ActionItemSchema, InvoiceSchema, ProposalSchema } from '@/lib/schemas'
import { total } from '@/lib/format'
import { jsonError, readJson, serverError } from '@/lib/http'

const Edit = z.object({
  proposal: ProposalSchema.optional(),
  invoice: InvoiceSchema.omit({ number: true }).optional(),
  action_items: z.array(ActionItemSchema).max(100).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { user } = await requireUser()
  if (!user) return jsonError('Unauthorized', 401)
  const parsed = Edit.safeParse(await readJson(req))
  if (!parsed.success) return jsonError(`Invalid ${parsed.error.issues[0].path.join('.')}: ${parsed.error.issues[0].message}`, 400)

  const admin = createAdminClient()
  const { data: call } = await admin
    .from('calls')
    .select('id,status,summary,proposal,invoice,action_items')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!call) return jsonError('Not found', 404)
  if (call.status !== 'ready') return jsonError('This call is still processing.', 409)

  const e = parsed.data
  const proposal = e.proposal ?? call.proposal
  const invoice = e.invoice ? { ...e.invoice, number: call.invoice.number } : call.invoice
  const action_items = e.action_items ?? call.action_items

  const { data: saved, error } = await admin
    .from('calls')
    .update({ proposal, invoice, action_items, amount_total: total(proposal.pricing) })
    .eq('id', call.id)
    .eq('status', 'ready')
    .select('*')
    .maybeSingle()
  if (error) return serverError('edit call', error)
  if (!saved) return jsonError('This call changed while you were editing. Reload and try again.', 409)

  await admin.from('call_outputs').insert({
    call_id: call.id,
    user_id: user.id,
    source: 'edit',
    summary: call.summary,
    proposal,
    action_items,
    invoice,
  })
  return NextResponse.json(saved)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { user } = await requireUser()
  if (!user) return jsonError('Unauthorized', 401)

  const admin = createAdminClient()
  const { data: call } = await admin
    .from('calls')
    .select('id,status,audio_path,audio_deleted_at,assemblyai_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!call) return jsonError('Not found', 404)

  if (call.audio_path && !call.audio_deleted_at) {
    const { error } = await admin.storage.from('recordings').remove([call.audio_path])
    if (error) return serverError('delete audio', error)
  }
  if (call.assemblyai_id) await deleteTranscription(call.assemblyai_id)

  const { error } = await admin.from('calls').delete().eq('id', call.id).eq('user_id', user.id)
  if (error) return serverError('delete call', error)
  // An upload that never finished never cost anything, so it shouldn't use up a call.
  if (call.status === 'uploading') {
    await admin.from('usage_events').delete().eq('call_id', call.id).eq('kind', 'call')
  }
  return NextResponse.json({ ok: true })
}
