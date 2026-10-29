import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { planForPriceId } from '@/lib/plans'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session
      if (s.client_reference_id && s.customer) {
        await admin.from('profiles').update({ stripe_customer_id: s.customer as string }).eq('id', s.client_reference_id)
      }
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const deleted = event.type === 'customer.subscription.deleted'
      const update = {
        stripe_customer_id: sub.customer as string,
        subscription_status: deleted ? 'canceled' : sub.status,
        plan: deleted ? 'free' : planForPriceId(sub.items.data[0]?.price.id ?? ''),
      }
      const userId = sub.metadata?.user_id
      if (userId) await admin.from('profiles').update(update).eq('id', userId)
      else await admin.from('profiles').update(update).eq('stripe_customer_id', sub.customer as string)
      break
    }
  }
  return NextResponse.json({ received: true })
}
