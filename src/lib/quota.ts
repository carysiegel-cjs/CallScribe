import type { SupabaseClient } from '@supabase/supabase-js'
import { PLANS, effectivePlan } from './plans'
import type { Profile } from './types'

export async function checkQuota(supabase: SupabaseClient, profile: Profile) {
  const plan = PLANS[effectivePlan(profile.plan, profile.subscription_status)]
  if (plan.callsPerMonth === Infinity) return { ok: true as const }

  let q = supabase.from('calls').select('id', { count: 'exact', head: true }).eq('user_id', profile.id)
  if (!plan.lifetime) {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    q = q.gte('created_at', start.toISOString())
  }
  const { count } = await q
  if ((count ?? 0) >= plan.callsPerMonth) {
    return {
      ok: false as const,
      message: plan.lifetime
        ? `Your free trial includes ${plan.callsPerMonth} calls. Upgrade to keep going.`
        : `You've used all ${plan.callsPerMonth} calls this month on ${plan.name}. Upgrade to Pro for unlimited.`,
    }
  }
  return { ok: true as const }
}
