export const PLANS = {
  free: { name: 'Free trial', price: 0, callsPerMonth: 3, lifetime: true },
  solo: { name: 'Solo', price: 39, callsPerMonth: 25, lifetime: false },
  pro: { name: 'Pro', price: 79, callsPerMonth: Infinity, lifetime: false },
} as const

export type PlanId = keyof typeof PLANS

export function priceIdFor(plan: 'solo' | 'pro') {
  return plan === 'solo' ? process.env.STRIPE_PRICE_SOLO! : process.env.STRIPE_PRICE_PRO!
}

export function planForPriceId(priceId: string): PlanId {
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_SOLO) return 'solo'
  return 'free'
}

// Paid plans only count while the Stripe subscription is in good standing.
export function effectivePlan(plan: string, status: string | null): PlanId {
  if ((plan === 'solo' || plan === 'pro') && (status === 'active' || status === 'trialing')) return plan
  return 'free'
}
