import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/redirect'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (code) {
    const { error } = await createClient().auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL('/login?error=link', url.origin))
  }
  return NextResponse.redirect(safeNext(url.searchParams.get('next'), url.origin))
}
