import Anthropic from '@anthropic-ai/sdk'
import type { ActionItem, Invoice, Profile, Proposal } from './types'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
const MAX_TRANSCRIPT_CHARS = 400_000

const lineItem = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    quantity: { type: 'number' },
    unit_price: { type: 'number' },
  },
  required: ['description', 'quantity', 'unit_price'],
}

const tool: Anthropic.Tool = {
  name: 'save_outputs',
  description: 'Save the proposal, action items and invoice derived from the call.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '3-5 sentence summary of the call.' },
      proposal: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          overview: { type: 'string', description: "Restate the client's problem and the proposed solution." },
          objectives: { type: 'array', items: { type: 'string' } },
          scope: { type: 'array', items: { type: 'string' } },
          out_of_scope: { type: 'array', items: { type: 'string' } },
          deliverables: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, description: { type: 'string' } },
              required: ['name', 'description'],
            },
          },
          timeline: {
            type: 'array',
            items: {
              type: 'object',
              properties: { phase: { type: 'string' }, duration: { type: 'string' } },
              required: ['phase', 'duration'],
            },
          },
          pricing: { type: 'array', items: lineItem },
          terms: { type: 'string' },
        },
        required: ['title', 'overview', 'objectives', 'scope', 'out_of_scope', 'deliverables', 'timeline', 'pricing', 'terms'],
      },
      action_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task: { type: 'string' },
            owner: { type: 'string', description: '"me" for the service provider, "client", or a named person.' },
            due: { type: ['string', 'null'], description: 'ISO date or relative phrase if mentioned, else null.' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['task', 'owner', 'due', 'priority'],
        },
      },
      invoice: {
        type: 'object',
        description: 'Invoice for work that is billable now (deposit, completed work, or first milestone).',
        properties: {
          line_items: { type: 'array', items: lineItem },
          notes: { type: 'string' },
        },
        required: ['line_items', 'notes'],
      },
    },
    required: ['summary', 'proposal', 'action_items', 'invoice'],
  },
}

export type Generated = {
  summary: string
  proposal: Proposal
  action_items: ActionItem[]
  invoice: Pick<Invoice, 'line_items' | 'notes'>
}

export async function generateOutputs(args: {
  transcript: string
  title: string
  clientName: string | null
  profile: Profile | null
}): Promise<Generated> {
  const { transcript, title, clientName, profile } = args
  const anthropic = new Anthropic()

  const system = `You are an expert business consultant who turns client call transcripts into
polished, client-ready documents for a freelancer/agency ("me").

Rules:
- Base everything on the transcript. Do not invent commitments the client did not discuss.
- If prices were discussed, use them exactly. Otherwise estimate using the provider's
  hourly rate of ${profile?.hourly_rate ?? 150} ${profile?.currency ?? 'USD'} and realistic hour counts.
- Proposal language: confident, specific, concise, written to the client in second person.
- Action items: concrete, one verb each, with an owner.
- Invoice: bill only what is due now. If a deposit was agreed, invoice the deposit. If nothing
  was agreed, invoice a 50% deposit of the proposal total as a single line item.
- Unit prices are numbers in ${profile?.currency ?? 'USD'} with no currency symbols.`

  const user = `Provider business: ${profile?.business_name || 'Independent consultant'}
Client: ${clientName || 'Unknown (infer from transcript if possible)'}
Call title: ${title}

<transcript>
${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}
</transcript>`

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: user }],
  })

  const block = res.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('Model returned no structured output')
  return block.input as Generated
}
