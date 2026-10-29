import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { requireUser } from '@/lib/supabase/server'
import { PLANS } from '@/lib/plans'

const features = [
  ['Upload or paste', 'Drop in an audio/video recording or paste a transcript from Zoom, Meet or Otter.'],
  ['Proposal', 'Scope, deliverables, timeline and pricing written in your voice, ready to send.'],
  ['Action items', 'Who does what by when, for you and the client.'],
  ['Invoice', 'Line items, due date and totals. Print to PDF in one click.'],
]

export default async function Home() {
  const { user } = await requireUser()
  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-5xl px-4">
        <section className="py-20 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Turn client calls into proposals, tasks and invoices.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600">
            Upload the recording. Two minutes later you have everything you need to close the deal and get paid.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href={user ? '/calls/new' : '/login'} className="btn-primary px-6 py-3">
              Try it free — {PLANS.free.callsPerMonth} calls
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2">
          {features.map(([t, d]) => (
            <div key={t} className="card p-6">
              <h3 className="font-medium">{t}</h3>
              <p className="mt-1 text-sm text-zinc-600">{d}</p>
            </div>
          ))}
        </section>

        <section id="pricing" className="pb-24">
          <h2 className="text-center text-2xl font-semibold">Pricing</h2>
          <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
            {(['solo', 'pro'] as const).map((id) => {
              const p = PLANS[id]
              return (
                <div key={id} className="card p-6">
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="mt-2 text-3xl font-semibold">${p.price}<span className="text-base font-normal text-zinc-500">/mo</span></p>
                  <ul className="mt-4 space-y-1 text-sm text-zinc-600">
                    <li>{p.callsPerMonth === Infinity ? 'Unlimited calls' : `${p.callsPerMonth} calls / month`}</li>
                    <li>Proposals, action items, invoices</li>
                    <li>Speaker-labelled transcripts</li>
                    {id === 'pro' && <li>Priority processing</li>}
                  </ul>
                  <Link href={user ? '/settings' : '/login'} className="btn-primary mt-6 w-full">Choose {p.name}</Link>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </>
  )
}
