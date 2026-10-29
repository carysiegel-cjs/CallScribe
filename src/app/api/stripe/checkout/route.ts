import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { priceIdFor } from '@/lib/plans'

export async function POST(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = (await req.json()) as { plan: 'solo' | 'pro' }
  if (plan !== 'solo' && plan !== 'pro') return NextResponse.json({ error: 'Bad plan' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  const app = process.env.NEXT_PUBLIC_APP_URL

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceIdFor(plan), quantity: 1 }],
    client_reference_id: user.id,
    ...(profile?.stripe_customer_id ? { customer: profile.stripe_customer_id } : { customer_email: user.email }),
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    success_url: `${app}/settings?upgraded=1`,
    cancel_url: `${app}/settings`,
  })
  return NextResponse.json({ url: session.url })
}
