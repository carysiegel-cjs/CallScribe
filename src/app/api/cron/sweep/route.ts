import { NextResponse } from 'next/server'
import { sweep } from '@/lib/pipeline'

export const maxDuration = 300

async function handler(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await sweep())
}

// Vercel Cron sends GET; pg_net sends POST.
export { handler as GET, handler as POST }
