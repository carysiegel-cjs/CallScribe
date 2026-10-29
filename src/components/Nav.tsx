import Link from 'next/link'

export function Nav({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-zinc-200 bg-white print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={email ? '/dashboard' : '/'} className="font-semibold tracking-tight">CallScribe</Link>
        {email ? (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900">Calls</Link>
            <Link href="/settings" className="text-zinc-600 hover:text-zinc-900">Settings</Link>
            <form action="/auth/signout" method="post">
              <button className="text-zinc-600 hover:text-zinc-900">Sign out</button>
            </form>
            <Link href="/calls/new" className="btn-primary">New call</Link>
          </nav>
        ) : (
          <Link href="/login" className="btn-primary">Sign in</Link>
        )}
      </div>
    </header>
  )
}
