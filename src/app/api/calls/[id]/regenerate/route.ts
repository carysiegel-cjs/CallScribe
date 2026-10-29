import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_REGENERATIONS } from '@/lib/plans'
import { jsonError, serverError } from '@/lib/http'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { user } = await requireUser()
  if (!user) return jsonError('Unauthorized', 401)

  const { data: ok, error } = await createAdminClient().rpc('regenerate_call', {
    p_user: user.id,
    p_id: params.id,
    p_max: MAX_REGENERATIONS,
  })
  if (error) return serverError('regenerate', error)
  if (!ok) return jsonError(`Regenerate is limited to ${MAX_REGENERATIONS} times per call, once it has finished processing.`, 409)
  return NextResponse.json({ ok: true })
}
