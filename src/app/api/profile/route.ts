import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/server'
import { CurrencySchema } from '@/lib/schemas'
import { jsonError, readJson, serverError } from '@/lib/http'

const Body = z.object({
  business_name: z.string().trim().max(200),
  business_address: z.string().trim().max(500),
  hourly_rate: z.coerce.number().min(0).max(100000),
  currency: CurrencySchema,
  payment_terms_days: z.coerce.number().int().min(0).max(365),
})

export async function PATCH(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return jsonError('Unauthorized', 401)
  const parsed = Body.safeParse(await readJson(req))
  if (!parsed.success) return jsonError(parsed.error.issues[0].message, 400)
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id)
  if (error) return serverError('profile update', error)
  return NextResponse.json({ ok: true })
}
