import Link from 'next/link'

export function UsageMeter({ used, limit, lifetime }: { used: number; limit: number; lifetime: boolean }) {
  if (!Number.isFinite(limit)) return <p className="text-sm text-zinc-500">Unlimited calls</p>
  const pct = Math.min(100, (used / limit) * 100)
  return (
    <div className="w-full max-w-xs text-sm">
      <div className="flex justify-between text-zinc-600">
        <span>{used} of {limit} {lifetime ? 'trial calls' : 'calls this month'}</span>
        {used >= limit - 1 && <Link href="/settings" className="link">Upgrade</Link>}
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-zinc-200" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label="Calls used">
        <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-red-600' : 'bg-zinc-900'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
