import { Shell } from '@/components/Shell'
import { OnboardingBanner } from '@/components/OnboardingBanner'
import { UsageMeter } from '@/components/UsageMeter'
import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/plans'
import { planOf, quotaMessage, usage } from '@/lib/quota'
import type { Profile } from '@/lib/types'
import { NewCallForm } from './NewCallForm'

export default async function NewCall() {
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('*').maybeSingle()
  const profile = data as Profile | null
  const planId = profile ? planOf(profile) : 'free'
  const u = profile ? await usage(supabase, profile) : null

  return (
    <Shell>
      {profile && !profile.business_name && <OnboardingBanner />}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">New call</h1>
        {u && <UsageMeter used={u.used} limit={u.limit} lifetime={u.lifetime} />}
      </div>
      <NewCallForm
        maxUploadMB={PLANS[planId].maxUploadMB}
        blockedMessage={u && u.remaining <= 0 ? quotaMessage(planId) : null}
      />
    </Shell>
  )
}
