import Link from 'next/link'

export function Nav({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-zinc-200 bg-white print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href={email ? '/dashboard' : '/'} className="font-semibold tracking-tight">CallScribe</Link>
        {email ? (
          <nav aria-label="Main" className="flex items-center gap-3 text-sm sm:gap-5">
            <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900">Calls</Link>
            <Link href="/settings" className="text-zinc-600 hover:text-zinc-900">Settings</Link>
            <Link href="/calls/new" className="btn-primary px-3">
              New<span className="hidden sm:inline">&nbsp;call</span>
            </Link>
          </nav>
        ) : (
          <Link href="/login" className="btn-primary">Sign in</Link>
        )}
      </div>
    </header>
  )
}
