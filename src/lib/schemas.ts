import { z } from 'zod'

// Shared by AI output validation and user edits.
const text = (max: number) => z.string().trim().max(max)

export const LineItemSchema = z.object({
  description: text(500).min(1),
  quantity: z.coerce.number().min(0).max(100_000),
  unit_price: z.coerce.number().min(0).max(10_000_000),
})

export const ProposalSchema = z.object({
  title: text(300).min(1),
  overview: text(10_000),
  objectives: z.array(text(1000)).max(50),
  scope: z.array(text(1000)).max(100),
  out_of_scope: z.array(text(1000)).max(100).default([]),
  deliverables: z.array(z.object({ name: text(300), description: text(2000) })).max(100),
  timeline: z.array(z.object({ phase: text(300), duration: text(100) })).max(50),
  pricing: z.array(LineItemSchema).max(100),
  terms: text(10_000),
})

export const ActionItemSchema = z.object({
  task: text(1000).min(1),
  owner: text(200),
  due: text(100).nullable().default(null),
  priority: z.enum(['high', 'medium', 'low']).catch('medium'),
})

export const InvoiceSchema = z.object({
  number: text(50),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  line_items: z.array(LineItemSchema).min(1).max(100),
  notes: text(5000).default(''),
})

export const GeneratedSchema = z.object({
  summary: text(5000),
  proposal: ProposalSchema,
  action_items: z.array(ActionItemSchema).max(100),
  invoice: z.object({ line_items: z.array(LineItemSchema).min(1).max(100), notes: text(5000).default('') }),
})

export const CurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD')
  .refine((c) => {
    try {
      new Intl.NumberFormat('en-US', { style: 'currency', currency: c })
      return true
    } catch {
      return false
    }
  }, 'Unknown currency code')
