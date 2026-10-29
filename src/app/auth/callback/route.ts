import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/dashboard'
  if (code) await createClient().auth.exchangeCodeForSession(code)
  return NextResponse.redirect(new URL(next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard', url.origin))
}
