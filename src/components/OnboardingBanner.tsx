import Link from 'next/link'

export function OnboardingBanner() {
  return (
    <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <b>Add your business details</b> so proposals and invoices show your name, address and rate (currently $150/hr by default).{' '}
      <Link href="/settings?onboarding=1" className="link font-medium">Add details</Link>
    </div>
  )
}
