import { requireUser } from '@/lib/supabase/server'
import { Nav } from './Nav'

export async function Shell({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser()
  return (
    <>
      <Nav email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  )
}
