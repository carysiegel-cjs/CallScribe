import Link from 'next/link'
import { Shell } from '@/components/Shell'
import { StatusBadge } from '@/components/StatusBadge'
import { UsageMeter } from '@/components/UsageMeter'
import { OnboardingBanner } from '@/components/OnboardingBanner'
import { createClient } from '@/lib/supabase/server'
import { usage } from '@/lib/quota'
import { date, money } from '@/lib/format'
import type { CallSummary, Profile } from '@/lib/types'

const PAGE_SIZE = 25

export default async function Dashboard({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const supabase = createClient()
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from('profiles').select('*').maybeSingle(),
    supabase
      .from('calls')
      .select('id,title,client_name,status,created_at,amount_total')
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE), // one extra row tells us if there's a next page
  ])
  const rows = (data ?? []) as CallSummary[]
  const calls = rows.slice(0, PAGE_SIZE)
  const hasNext = rows.length > PAGE_SIZE
  const p = profile as Profile | null
  const u = p ? await usage(supabase, p) : null
  const cur = p?.currency ?? 'USD'

  return (
    <Shell>
      {p && !p.business_name && <OnboardingBanner />}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Calls</h1>
        {u && <UsageMeter used={u.used} limit={u.limit} lifetime={u.lifetime} />}
      </div>

      {calls.length === 0 && page === 1 ? (
        <div className="card p-12 text-center">
          <p className="font-medium">No calls yet</p>
          <p className="mt-1 text-sm text-zinc-600">Upload a recording or paste a transcript to get your first proposal.</p>
          <Link href="/calls/new" className="btn-primary mt-4">Process your first call</Link>
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-zinc-100">
            {calls.map((c) => (
              <li key={c.id}>
                <Link href={`/calls/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="truncate text-sm text-zinc-500">{c.client_name || 'No client'} · {date(c.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-sm">
                    {c.amount_total != null && <span className="hidden text-zinc-600 sm:inline">{money(c.amount_total, cur)}</span>}
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {(page > 1 || hasNext) && (
            <nav aria-label="Pagination" className="mt-4 flex justify-between text-sm">
              {page > 1 ? <Link href={`/dashboard?page=${page - 1}`} className="btn-ghost">Newer</Link> : <span />}
              {hasNext && <Link href={`/dashboard?page=${page + 1}`} className="btn-ghost">Older</Link>}
            </nav>
          )}
        </>
      )}
    </Shell>
  )
}
