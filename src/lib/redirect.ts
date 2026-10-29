// Only allow redirects back to our own origin (blocks //evil.com, /\evil.com, etc.).
export function safeNext(next: string | null, origin: string) {
  try {
    const dest = new URL(next ?? '/dashboard', origin)
    if (dest.origin === origin) return dest
  } catch {}
  return new URL('/dashboard', origin)
}
