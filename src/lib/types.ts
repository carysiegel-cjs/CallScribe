import type { z } from 'zod'
import type { ActionItemSchema, InvoiceSchema, LineItemSchema, ProposalSchema } from './schemas'

export type LineItem = z.infer<typeof LineItemSchema>
export type Proposal = z.infer<typeof ProposalSchema>
export type ActionItem = z.infer<typeof ActionItemSchema>
export type Invoice = z.infer<typeof InvoiceSchema>

export type CallStatus = 'uploading' | 'transcribing' | 'queued' | 'generating' | 'ready' | 'error'
export const PENDING_STATUSES: CallStatus[] = ['uploading', 'transcribing', 'queued', 'generating']

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
  invoice_number: number | null
  amount_total: number | null
  error: string | null
  attempts: number
  regen_count: number
  claim_token: string | null
  next_attempt_at: string | null
  created_at: string
  updated_at: string
}

export type CallSummary = Pick<Call, 'id' | 'title' | 'client_name' | 'status' | 'created_at' | 'amount_total'>

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
