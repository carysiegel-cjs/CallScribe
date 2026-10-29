import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/server'

const Body = z.object({
  business_name: z.string().max(200),
  business_address: z.string().max(500),
  hourly_rate: z.coerce.number().min(0).max(100000),
  currency: z.string().length(3).toUpperCase(),
  payment_terms_days: z.coerce.number().int().min(0).max(365),
})

export async function PATCH(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
