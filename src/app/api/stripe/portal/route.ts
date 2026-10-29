import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  if (!profile?.stripe_customer_id) return NextResponse.json({ error: 'No subscription' }, { status: 400 })

  const session = await stripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  })
  return NextResponse.json({ url: session.url })
}
