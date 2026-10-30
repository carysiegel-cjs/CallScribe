import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'

type CookieList = { name: string; value: string; options: CookieOptions }[]

const PROTECTED = ['/dashboard', '/calls', '/settings']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Never take the whole site down if auth can't be checked: treat the visitor as signed out.
  let user = null
  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list: CookieList) {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    ;({ data: { user } } = await supabase.auth.getUser())
  } catch (e) {
    console.error('[middleware] auth check failed', e)
  }
  const path = request.nextUrl.pathname

  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }
  return response
}
