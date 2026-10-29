export type LineItem = { description: string; quantity: number; unit_price: number }

export type Proposal = {
  title: string
  overview: string
  objectives: string[]
  scope: string[]
  out_of_scope: string[]
  deliverables: { name: string; description: string }[]
  timeline: { phase: string; duration: string }[]
  pricing: LineItem[]
  terms: string
}

export type ActionItem = {
  task: string
  owner: 'me' | 'client' | string
  due: string | null
  priority: 'high' | 'medium' | 'low'
}

export type Invoice = {
  number: string
  issue_date: string
  due_date: string
  line_items: LineItem[]
  notes: string
}

export type CallStatus = 'transcribing' | 'queued' | 'generating' | 'ready' | 'error'

export type Call = {
  id: string
  user_id: string
  title: string
  client_name: string | null
  client_email: string | null
  status: CallStatus
  audio_path: string | null
  assemblyai_id: string | null
  transcript: string | null
  summary: string | null
  proposal: Proposal | null
  action_items: ActionItem[] | null
  invoice: Invoice | null
  error: string | null
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  email: string | null
  business_name: string | null
  business_address: string | null
  hourly_rate: number | null
  currency: string | null
  payment_terms_days: number | null
  plan: 'free' | 'solo' | 'pro'
  subscription_status: string | null
  stripe_customer_id: string | null
}
