import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { advance } from '@/lib/pipeline'
import type { Call } from '@/lib/types'

// Generation runs inside this request; allow time for long transcripts.
export const maxDuration = 300

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('calls').select('*').eq('id', params.id).single()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const call = await advance(data as Call)
  return NextResponse.json(call)
}
