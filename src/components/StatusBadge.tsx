import type { CallStatus } from '@/lib/types'

const styles: Record<CallStatus, string> = {
  transcribing: 'bg-amber-50 text-amber-700',
  queued: 'bg-amber-50 text-amber-700',
  generating: 'bg-blue-50 text-blue-700',
  ready: 'bg-emerald-50 text-emerald-700',
  error: 'bg-red-50 text-red-700',
}

const labels: Record<CallStatus, string> = {
  transcribing: 'Transcribing',
  queued: 'Queued',
  generating: 'Writing',
  ready: 'Ready',
  error: 'Error',
}

export function StatusBadge({ status }: { status: CallStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{labels[status]}</span>
}
