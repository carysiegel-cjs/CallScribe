import type { CallStatus } from '@/lib/types'

const styles: Record<CallStatus, string> = {
  uploading: 'bg-amber-50 text-amber-800',
  transcribing: 'bg-amber-50 text-amber-800',
  queued: 'bg-amber-50 text-amber-800',
  generating: 'bg-blue-50 text-blue-800',
  ready: 'bg-emerald-50 text-emerald-800',
  error: 'bg-red-50 text-red-800',
}

const labels: Record<CallStatus, string> = {
  uploading: 'Uploading',
  transcribing: 'Transcribing',
  queued: 'Queued',
  generating: 'Writing',
  ready: 'Ready',
  error: 'Error',
}

export function StatusBadge({ status }: { status: CallStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{labels[status]}</span>
}
