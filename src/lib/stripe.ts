import Stripe from 'stripe'
import { planForPriceId, type PlanId } from './plans'
import { createAdminClient } from './supabase/admin'

export const stripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!)

// Paid plans are offered only once Stripe is configured; until then the free trial still works.
export const billingEnabled = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_SOLO && process.env.STRIPE_PRICE_PRO)

const RANK: Record<PlanId, number> = { free: 0, solo: 1, pro: 2 }

// Recompute the plan from Stripe's current state instead of trusting a single
// event, so out-of-order or duplicate webhooks always converge to the truth.
export async function syncCustomer(customerId: string, userId?: string | null) {
  const subs = await stripe().subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
  const live = subs.data.filter((s) => ['active', 'trialing', 'past_due'].includes(s.status))
  const best = live.sort(
    (a, b) => RANK[planForPriceId(b.items.data[0]?.price.id ?? '')] - RANK[planForPriceId(a.items.data[0]?.price.id ?? '')],
  )[0]

  const update = {
    stripe_customer_id: customerId,
    plan: best ? planForPriceId(best.items.data[0]?.price.id ?? '') : 'free',
    subscription_status: best?.status ?? 'canceled',
  }
  const admin = createAdminClient()
  const q = admin.from('profiles').update(update)
  const { error } = userId ? await q.eq('id', userId) : await q.eq('stripe_customer_id', customerId)
  if (error) throw error
}
