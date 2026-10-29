import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  await createClient().auth.signOut()
  return NextResponse.redirect(new URL('/', req.url), { status: 303 })
}
