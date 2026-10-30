import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '../config'

// Service-role client: bypasses RLS. Server-only (webhooks, background steps).
export function createAdminClient() {
  return createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}
