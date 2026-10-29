import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: call } = await supabase.from('calls').select('audio_path').eq('id', params.id).single()
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (call.audio_path) await supabase.storage.from('recordings').remove([call.audio_path])
  await supabase.from('calls').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
