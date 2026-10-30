import { AssemblyAI } from 'assemblyai'
import { MAX_AUDIO_MS } from './plans'
import { createAdminClient } from './supabase/admin'

const client = () => new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })

const SIGNED_URL_SECONDS = 15 * 60

function webhookConfig() {
  const app = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET
  // AssemblyAI can't reach localhost; polling and the sweeper cover local dev.
  if (!app.startsWith('https://') || !secret) return {}
  return {
    webhook_url: `${app}/api/webhooks/assemblyai`,
    webhook_auth_header_name: 'x-webhook-secret',
    webhook_auth_header_value: secret,
  }
}

export async function startTranscription(audioPath: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('recordings').createSignedUrl(audioPath, SIGNED_URL_SECONDS)
  if (error || !data) throw new Error(`Could not sign audio URL: ${error?.message}`)
  const t = await client().transcripts.submit({
    audio: data.signedUrl,
    // Cheapest pre-recorded model ($0.15/hr) + standard speaker labels (+$0.02/hr).
    speech_models: ['universal-2'],
    speaker_labels: true,
    audio_end_at: MAX_AUDIO_MS,
    ...webhookConfig(),
  })
  return t.id
}

export type TranscriptionResult = { done: false } | { done: true; text: string } | { done: true; error: string }

export async function checkTranscription(id: string): Promise<TranscriptionResult> {
  const t = await client().transcripts.get(id)
  if (t.status === 'error') return { done: true, error: 'We could not transcribe this recording. Check the file has clear audio.' }
  if (t.status !== 'completed') return { done: false }
  const text = t.utterances?.length
    ? t.utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join('\n')
    : t.text ?? ''
  if (!text.trim()) return { done: true, error: 'No speech was found in this recording.' }
  return { done: true, text }
}

// Remove the provider's copy once we've stored the transcript.
export async function deleteTranscription(id: string) {
  try {
    await client().transcripts.delete(id)
  } catch (e) {
    console.error('[assemblyai delete]', e)
  }
}
