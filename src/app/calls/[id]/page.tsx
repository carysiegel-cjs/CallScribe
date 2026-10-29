import { notFound } from 'next/navigation'
import { Shell } from '@/components/Shell'
import { createClient } from '@/lib/supabase/server'
import type { Call, Profile } from '@/lib/types'
import { CallView } from './CallView'

export default async function CallPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: call }, { data: profile }] = await Promise.all([
    supabase.from('calls').select('*').eq('id', params.id).single(),
    supabase.from('profiles').select('*').single(),
  ])
  if (!call) notFound()
  return (
    <Shell>
      <CallView initial={call as Call} profile={profile as Profile} />
    </Shell>
  )
}
