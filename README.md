# CallScribe

Upload a client call recording (or paste a transcript) → get a proposal, action items and an invoice.

**Stack:** Next.js 14 (App Router) · Supabase (auth, Postgres, storage) · AssemblyAI (transcription) · Claude (generation) · Stripe (subscriptions) · Vercel (hosting).

## How it works

```
Browser ──upload──▶ Supabase Storage (private bucket, per-user folder)
   │
   └─POST /api/calls ─▶ AssemblyAI submit (signed URL)   status: transcribing
                        or pasted transcript             status: queued
Browser polls GET /api/calls/:id/status
   ├─ transcribing → checks AssemblyAI; on completion saves transcript → queued
   └─ queued       → atomically claims job → Claude (tool-use JSON) → ready
```

No queue or worker needed: the polling request advances the job. The claim is a conditional
update, so concurrent polls never generate twice; a job stuck in `generating` for 3+ min is reclaimed.

## Plans

| Plan | Price | Calls |
|------|-------|-------|
| Free trial | $0 | 3 total |
| Solo | $39/mo | 25 / month |
| Pro | $79/mo | Unlimited |

Edit limits in `src/lib/plans.ts`.

## Setup (≈20 min)

### 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → paste and run `supabase/schema.sql` (tables, RLS, profile trigger, `recordings` bucket).
3. Authentication → URL Configuration: set **Site URL** to your app URL and add
   `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback` to **Redirect URLs**.
4. Storage → Settings: raise the global upload limit if needed (free plan caps at 50 MB per file;
   a 1-hour call as MP3 is ~60 MB, as M4A ~30 MB).
5. Project Settings → API: copy URL, `anon` key, `service_role` key.

### 2. AssemblyAI
Sign up at assemblyai.com and copy the API key (~$0.15–0.37/hr of audio depending on model).

### 3. Anthropic
Create an API key at console.anthropic.com. Model defaults to `claude-sonnet-5-5`; override with `ANTHROPIC_MODEL`.

### 4. Stripe
1. Products → create **Solo** ($39/mo recurring) and **Pro** ($79/mo recurring). Copy both price IDs.
2. Settings → Billing → Customer portal: enable it (plan switching + cancellation).
3. Webhook (after deploy): Developers → Webhooks → add endpoint
   `https://YOUR-DOMAIN/api/stripe/webhook` with events
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret.

Local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### 5. Run locally
```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

## Deploy to Vercel
1. Push this repo to GitHub.
2. vercel.com → Add New Project → import the repo (framework auto-detected).
3. Add every variable from `.env.example`; set `NEXT_PUBLIC_APP_URL` to the production URL.
4. Deploy. Then add the Stripe webhook (step 4.3) and Supabase redirect URL (step 1.3) for that domain.

`/api/calls/[id]/status` sets `maxDuration = 300`. On Vercel Hobby the cap is 60 s, which is enough
for typical calls; long transcripts (2h+) may need Pro.

## Unit economics (per 1-hour call)
- AssemblyAI: ~$0.15–0.37
- Claude Sonnet: ~15k input + ~3k output tokens ≈ $0.10
- **≈ $0.50 per call** → Solo at 25 calls ≈ $12.50 cost on $39 revenue worst case.

## Project layout
```
supabase/schema.sql            DB, RLS, storage bucket
src/lib/ai.ts                  Claude prompt + JSON schema (tool use)
src/lib/transcribe.ts          AssemblyAI submit/check
src/lib/pipeline.ts            State machine: transcribing → queued → generating → ready
src/lib/quota.ts, plans.ts     Plan limits
src/app/api/...                Calls, profile, Stripe checkout/portal/webhook
src/app/calls/[id]/CallView.tsx Proposal / action items / invoice / transcript views
```

## Next steps after MVP
- Editable invoice line items before sending
- Stripe payment links on invoices
- Zoom / Google Meet import
- Custom proposal templates and branding (logo)
