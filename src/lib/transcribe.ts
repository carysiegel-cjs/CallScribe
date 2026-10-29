import { AssemblyAI } from 'assemblyai'
import { createAdminClient } from './supabase/admin'

const client = () => new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })

// Submit without waiting; the status endpoint polls for completion.
export async function startTranscription(audioPath: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('recordings').createSignedUrl(audioPath, 60 * 60 * 6)
  if (error || !data) throw new Error(`Could not sign audio URL: ${error?.message}`)
  const t = await client().transcripts.submit({ audio: data.signedUrl, speaker_labels: true })
  return t.id
}

export async function checkTranscription(id: string):
  Promise<{ done: false } | { done: true; text: string } | { done: true; error: string }> {
  const t = await client().transcripts.get(id)
  if (t.status === 'error') return { done: true, error: t.error ?? 'Transcription failed' }
  if (t.status !== 'completed') return { done: false }
  const text = t.utterances?.length
    ? t.utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join('\n')
    : t.text ?? ''
  return { done: true, text }
}
