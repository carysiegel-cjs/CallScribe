import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { billingEnabled, stripe, syncCustomer } from '@/lib/stripe'

export async function POST(req: Request) {
  if (!billingEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }
  const sig = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.customer) await syncCustomer(s.customer as string, s.client_reference_id)
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await syncCustomer(sub.customer as string, sub.metadata?.user_id)
        break
      }
    }
  } catch (e) {
    console.error('[stripe webhook]', event.type, e)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 }) // Stripe retries
  }
  return NextResponse.json({ received: true })
}
