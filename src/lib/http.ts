import { NextResponse } from 'next/server'

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

// Log the real error server-side; never leak provider/database messages to the client.
export function serverError(context: string, err: unknown) {
  console.error(`[${context}]`, err)
  return jsonError('Something went wrong. Please try again.', 500)
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
