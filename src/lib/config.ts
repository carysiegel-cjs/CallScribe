// Public Supabase project details (safe to ship: they are sent to every browser anyway).
// Used as defaults only on Vercel deploys; anywhere else (local dev, CI) a missing env var
// fails loudly instead of silently pointing at the production database.
const ON_VERCEL = process.env.CALLSCRIBE_ON_VERCEL === '1'

function setting(value: string | undefined, vercelDefault: string, name: string) {
  if (value) return value
  if (ON_VERCEL) return vercelDefault
  throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`)
}

export const SUPABASE_URL = setting(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'https://ujsqmjzwondjkkmpmdzd.supabase.co',
  'NEXT_PUBLIC_SUPABASE_URL',
)
export const SUPABASE_ANON_KEY = setting(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqc3Ftanp3b25kamtrbXBtZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMTI0MzgsImV4cCI6MjEwODg4ODQzOH0.gWMN6i9T4cTpNeGNOfFxMn3MtdyxGyzRQyhK7olcNqE',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
)
