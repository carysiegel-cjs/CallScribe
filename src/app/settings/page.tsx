import { Shell } from '@/components/Shell'
import { createClient } from '@/lib/supabase/server'
import { PLANS, effectivePlan } from '@/lib/plans'
import type { Profile } from '@/lib/types'
import { BillingCard, ProfileForm } from './SettingsForms'

export default async function Settings({ searchParams }: { searchParams: { upgraded?: string } }) {
  const { data } = await createClient().from('profiles').select('*').single()
  const profile = data as Profile
  const plan = effectivePlan(profile.plan, profile.subscription_status)
  return (
    <Shell>
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      {searchParams.upgraded && (
        <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Thanks! Your plan updates within a few seconds.</p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <ProfileForm profile={profile} />
        <BillingCard plan={plan} planName={PLANS[plan].name} hasCustomer={!!profile.stripe_customer_id} />
      </div>
    </Shell>
  )
}
