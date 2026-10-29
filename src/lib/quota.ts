import type { SupabaseClient } from '@supabase/supabase-js'
import { PLANS, effectivePlan, type PlanId } from './plans'
import type { Profile } from './types'

export function planOf(profile: Pick<Profile, 'plan' | 'subscription_status'>): PlanId {
  return effectivePlan(profile.plan, profile.subscription_status)
}

// Usage for display. Enforcement happens atomically inside the create_call RPC.
export async function usage(supabase: SupabaseClient, profile: Profile) {
  const plan = PLANS[planOf(profile)]
  let q = supabase
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('kind', 'call')
  if (!plan.lifetime) {
    const start = new Date()
    q = q.gte('created_at', new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)).toISOString())
  }
  const { count } = await q
  const used = count ?? 0
  return { used, limit: plan.callsPerMonth, lifetime: plan.lifetime, remaining: Math.max(0, plan.callsPerMonth - used) }
}

export function quotaMessage(planId: PlanId) {
  const plan = PLANS[planId]
  return plan.lifetime
    ? `Your free trial includes ${plan.callsPerMonth} calls. Upgrade to keep going.`
    : `You've used all ${plan.callsPerMonth} calls this month on ${plan.name}. Upgrade to Pro for unlimited.`
}
