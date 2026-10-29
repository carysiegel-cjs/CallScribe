import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { priceIdFor } from '@/lib/plans'
import { planOf } from '@/lib/quota'
import { jsonError, readJson, serverError } from '@/lib/http'
import type { Profile } from '@/lib/types'

export async function POST(req: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return jsonError('Unauthorized', 401)

  const { plan } = ((await readJson(req)) ?? {}) as { plan?: string }
  if (plan !== 'solo' && plan !== 'pro') return jsonError('Bad plan', 400)

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile) return jsonError('Profile not found', 404)
  // Existing subscribers change plans in the portal; a second Checkout would double-bill.
  if (planOf(profile as Profile) !== 'free') return jsonError('You already have a subscription. Use Manage billing to change plans.', 409)

  const app = process.env.NEXT_PUBLIC_APP_URL
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],
      client_reference_id: user.id,
      ...(profile.stripe_customer_id ? { customer: profile.stripe_customer_id } : { customer_email: user.email }),
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${app}/settings?upgraded=1`,
      cancel_url: `${app}/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    return serverError('checkout', e)
  }
}
