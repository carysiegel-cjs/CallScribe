import Link from 'next/link'
import { Shell } from '@/components/Shell'
import { StatusBadge } from '@/components/StatusBadge'
import { createClient } from '@/lib/supabase/server'
import { date, money, total } from '@/lib/format'
import type { Call } from '@/lib/types'

export default async function Dashboard() {
  const supabase = createClient()
  const { data } = await supabase
    .from('calls')
    .select('id,title,client_name,status,created_at,proposal,invoice')
    .order('created_at', { ascending: false })
  const calls = (data ?? []) as Call[]

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calls</h1>
      </div>

      {calls.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-zinc-600">No calls yet.</p>
          <Link href="/calls/new" className="btn-primary mt-4">Process your first call</Link>
        </div>
      ) : (
        <div className="card divide-y divide-zinc-100">
          {calls.map((c) => (
            <Link key={c.id} href={`/calls/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.title}</p>
                <p className="text-sm text-zinc-500">{c.client_name || 'No client'} · {date(c.created_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm">
                {c.proposal && <span className="text-zinc-600">{money(total(c.proposal.pricing))}</span>}
                <StatusBadge status={c.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  )
}
