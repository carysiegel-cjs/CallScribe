import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startTranscription } from '@/lib/transcribe'
import { jsonError } from '@/lib/http'

// Called by the browser after its upload finishes; starts transcription.
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { user } = await requireUser()
  if (!user) return jsonError('Unauthorized', 401)

  const admin = createAdminClient()
  const { data: call } = await admin
    .from('calls')
    .select('id,audio_path,status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!call || !call.audio_path) return jsonError('Not found', 404)
  if (call.status !== 'uploading') return NextResponse.json({ ok: true })

  const folder = call.audio_path.split('/').slice(0, -1).join('/')
  const name = call.audio_path.split('/').pop()
  const { data: files } = await admin.storage.from('recordings').list(folder, { search: name })
  if (!files?.some((f) => f.name === name)) return jsonError('Upload not found. Please try again.', 409)

  try {
    const assemblyaiId = await startTranscription(call.audio_path)
    await admin
      .from('calls')
      .update({ status: 'transcribing', assemblyai_id: assemblyaiId })
      .eq('id', call.id)
      .eq('status', 'uploading')
  } catch (e) {
    console.error('[start transcription]', call.id, e)
    await admin.from('calls').update({ status: 'error', error: 'Could not start transcription. Please try again.' }).eq('id', call.id)
    await admin.from('usage_events').delete().eq('call_id', call.id).eq('kind', 'call')
    return jsonError('Could not start transcription. This call was not counted against your plan.', 502)
  }
  return NextResponse.json({ ok: true })
}
