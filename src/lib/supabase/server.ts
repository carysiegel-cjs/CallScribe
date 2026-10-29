import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieList = { name: string; value: string; options: CookieOptions }[]
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(list: CookieList) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    },
  )
}

export async function requireUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}
