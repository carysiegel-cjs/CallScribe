import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Endpoints called by other servers, authenticated by their own signatures/secrets.
const MACHINE = ['/api/stripe/webhook', '/api/webhooks/', '/api/cron/']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (MACHINE.some((p) => pathname.startsWith(p))) return NextResponse.next()

  // CSRF: state-changing API calls must come from our own pages.
  if (pathname.startsWith('/api/') && request.method !== 'GET') {
    const origin = request.headers.get('origin')
    if (!origin || origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
