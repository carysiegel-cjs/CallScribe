import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { requireUser } from '@/lib/supabase/server'
import { PLANS, type PlanId } from '@/lib/plans'

const features = [
  ['Upload or paste', 'Drop in an audio/video recording or paste a transcript from Zoom, Meet or Otter.'],
  ['Proposal', 'Scope, deliverables, timeline and pricing, drafted from what was actually said.'],
  ['Action items', 'Who does what by when, for you and the client.'],
  ['Invoice', 'Numbered invoice with line items and due date. Edit, then download as PDF.'],
]

function planHref(user: boolean, id: PlanId) {
  const target = id === 'free' ? '/calls/new' : `/settings?plan=${id}`
  return user ? target : `/login?next=${encodeURIComponent(target)}`
}

export default async function Home() {
  const { user } = await requireUser()
  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 text-center sm:py-20">
          <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Turn client calls into proposals, tasks and invoices.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600">
            Upload the recording and get ready-to-edit documents a few minutes later. Pasted transcripts take under a minute.
          </p>
          <Link href={planHref(!!user, 'free')} className="btn-primary mt-8 px-6 py-3">
            Try it free with {PLANS.free.callsPerMonth} calls
          </Link>
        </section>

        <section aria-label="Example output" className="mx-auto mb-16 max-w-3xl">
          <div className="card overflow-hidden shadow-sm">
            <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-2 text-xs text-zinc-600">Example: generated from a 25-minute discovery call</div>
            <div className="grid gap-6 p-6 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Proposal</p>
                <p className="mt-1 font-medium">Website redesign for Bright Dental</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700">
                  <li>5-page responsive site with online booking</li>
                  <li>Copy refresh and local SEO setup</li>
                  <li>Launch in 6 weeks · $6,400</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Next steps</p>
                <ul className="mt-2 space-y-1 text-zinc-700">
                  <li>☐ You: send proposal by Fri</li>
                  <li>☐ Client: share brand assets</li>
                  <li>☐ You: invoice 50% deposit ($3,200)</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2">
          {features.map(([t, d]) => (
            <div key={t} className="card p-6">
              <h2 className="font-medium">{t}</h2>
              <p className="mt-1 text-sm text-zinc-600">{d}</p>
            </div>
          ))}
        </section>

        <section id="pricing" className="pb-24">
          <h2 className="text-center text-2xl font-semibold">Pricing</h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
            {(['free', 'solo', 'pro'] as const).map((id) => {
              const p = PLANS[id]
              return (
                <div key={id} className={`card flex flex-col p-6 ${id === 'pro' ? 'border-zinc-900' : ''}`}>
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="mt-2 text-3xl font-semibold">${p.price}<span className="text-base font-normal text-zinc-500">{id === 'free' ? '' : '/mo'}</span></p>
                  <ul className="mt-4 flex-1 space-y-1 text-sm text-zinc-600">
                    <li>{p.callsPerMonth === Infinity ? 'Unlimited calls' : `${p.callsPerMonth} calls${p.lifetime ? ' total' : ' / month'}`}</li>
                    <li>Proposals, action items, invoices</li>
                    <li>Uploads up to {p.maxUploadMB} MB</li>
                  </ul>
                  <Link href={planHref(!!user, id)} className={`${id === 'pro' ? 'btn-primary' : 'btn-ghost'} mt-6 w-full`}>
                    {id === 'free' ? 'Start free' : `Choose ${p.name}`}
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </>
  )
}
