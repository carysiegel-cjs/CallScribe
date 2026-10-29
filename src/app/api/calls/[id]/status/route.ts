import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { advance } from '@/lib/pipeline'
import { jsonError } from '@/lib/http'
import { PENDING_STATUSES, type CallStatus } from '@/lib/types'

// May run generation inline; ai.ts times out at 240s so failures are recorded before this limit.
export const maxDuration = 300

const LIGHT = 'id,status,error,updated_at'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser()
  if (!user) return jsonError('Unauthorized', 401)

  // RLS scopes this read to the user's own calls.
  const { data } = await supabase.from('calls').select(LIGHT).eq('id', params.id).maybeSingle()
  if (!data) return jsonError('Not found', 404)
  if (!PENDING_STATUSES.includes(data.status as CallStatus) || data.status === 'uploading') return NextResponse.json(data)

  await advance(params.id)
  const { data: after } = await supabase.from('calls').select(LIGHT).eq('id', params.id).maybeSingle()
  return after ? NextResponse.json(after) : jsonError('Not found', 404)
}
