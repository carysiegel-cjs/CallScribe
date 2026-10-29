import type { LineItem } from './types'

export function money(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0)
  } catch {
    return `${currency} ${(amount || 0).toFixed(2)}`
  }
}

export function total(items: LineItem[] | undefined | null) {
  return (items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
}

export function date(iso: string) {
  // Date-only strings are parsed as UTC; format in UTC so the day doesn't shift.
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
  return new Date(iso).toLocaleDateString('en-US', /^\d{4}-\d{2}-\d{2}$/.test(iso) ? { ...opts, timeZone: 'UTC' } : opts)
}
