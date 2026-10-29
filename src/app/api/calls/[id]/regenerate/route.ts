import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('calls')
    .update({ status: 'queued', error: null })
    .eq('id', params.id)
    .in('status', ['ready', 'error'])
    .not('transcript', 'is', null)
    .select('id')
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'Nothing to regenerate yet' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
