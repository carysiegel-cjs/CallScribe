import { Shell } from '@/components/Shell'
import { UsageMeter } from '@/components/UsageMeter'
import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/plans'
import { planOf, usage } from '@/lib/quota'
import { billingEnabled } from '@/lib/stripe'
import type { Profile } from '@/lib/types'
import { BillingCard, ProfileForm } from './SettingsForms'

export default async function Settings({ searchParams }: { searchParams: { upgraded?: string; plan?: string; onboarding?: string } }) {
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('*').maybeSingle()
  if (!data) {
    return <Shell><p role="alert" className="text-sm text-red-700">Your profile could not be loaded. Sign out and back in.</p></Shell>
  }
  const profile = data as Profile
  const plan = planOf(profile)
  const u = await usage(supabase, profile)
  const wanted = searchParams.plan === 'solo' || searchParams.plan === 'pro' ? searchParams.plan : null

  return (
    <Shell>
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      {searchParams.upgraded && (
        <p role="status" className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Thanks! Your plan updates within a few seconds. Refresh if it hasn't changed.</p>
      )}
      {searchParams.onboarding && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Add your business details. They appear on every proposal and invoice.</p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <ProfileForm profile={profile} returnTo={searchParams.onboarding ? '/calls/new' : null} />
        <div className="space-y-6">
          <BillingCard
            plan={plan}
            planName={PLANS[plan].name}
            hasCustomer={!!profile.stripe_customer_id}
            autoCheckout={plan === 'free' && billingEnabled() ? wanted : null}
            billingEnabled={billingEnabled()}
            usage={<UsageMeter used={u.used} limit={u.limit} lifetime={u.lifetime} />}
          />
          <div className="card p-6">
            <h2 className="font-medium">Account</h2>
            <p className="mt-1 text-sm text-zinc-600">Signed in as {profile.email}</p>
            <form action="/auth/signout" method="post" className="mt-4">
              <button className="btn-ghost">Sign out</button>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  )
}
