import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { jsonError, serverError } from '@/lib/http'

export async function POST() {
  const { supabase, user } = await requireUser()
  if (!user) return jsonError('Unauthorized', 401)
  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle()
  if (!profile?.stripe_customer_id) return jsonError('No subscription yet', 400)

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    return serverError('portal', e)
  }
}
