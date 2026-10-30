# CallScribe

Upload a client call recording (or paste a transcript) → get a proposal, action items and an invoice.

**Stack:** Next.js 14 (App Router) · Supabase (auth, Postgres, storage) · AssemblyAI (transcription + LLM Gateway running Claude Haiku for generation) · Stripe (subscriptions) · Vercel (hosting).

## How it works

```
1. POST /api/calls            quota checked + usage recorded atomically (create_call RPC)
                              → returns a one-time signed upload URL (audio) or queues (transcript)
2. Browser uploads directly to Supabase Storage with a progress bar
3. POST /api/calls/:id/uploaded → AssemblyAI submit (15-min signed URL, 3h audio cap)
4. AssemblyAI webhook ─┐
   Status poll ────────┼─▶ advance(): transcript saved → recording + provider copy deleted
   Cron sweeper ───────┘           → claim_call RPC → Claude → validated output saved
```

- **Jobs don't depend on an open tab.** The AssemblyAI webhook and a 1-minute sweeper drive work; the
  status poll just makes it faster when the user is watching.
- **Every job is claimed atomically** with a claim token; a stale job is only reclaimed after 6 min
  (longer than any request can run) and gives up after 3 attempts, so a stuck call never bills forever.
- **Users can only read their data.** All writes go through the server; quota lives in an append-only
  `usage_events` ledger (deleting a call doesn't refund usage, except a call whose upload never
  finished). Regenerate is capped at 3 per call.
- **Outputs are versioned** in `call_outputs` (every generation and edit). Invoice numbers are
  sequential per user and never change on regenerate.
- **Stripe state is reconciled** from Stripe's API on every webhook, so out-of-order events can't
  put a user on the wrong plan. Existing subscribers change plan in the Stripe portal.

## Plans

| Plan | Price | Calls |
|------|-------|-------|
| Free trial | $0 | 3 total (50 MB uploads) |
| Solo | $39/mo | 25 / month (200 MB uploads) |
| Pro | $79/mo | Unlimited (200 MB uploads) |

Edit limits in `src/lib/plans.ts`.

## Setup (≈20 min)

### 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → paste and run `supabase/schema.sql` (tables, RLS, RPCs, `recordings` bucket).
3. Authentication → URL Configuration: set **Site URL** to your app URL and add
   `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback` to **Redirect URLs**.
4. Storage → Settings: the free Supabase plan caps uploads at 50 MB globally. For 200 MB paid
   uploads, upgrade Supabase and raise the global limit.
5. Project Settings → API: copy URL, `anon` key, `service_role` key.

### 2. AssemblyAI (one key for transcription and generation)
Sign up at assemblyai.com and copy the API key. Transcription uses `universal-2` + speaker labels
($0.17/hr of audio); documents are written by `claude-haiku-5-5` through AssemblyAI's LLM Gateway
(~$0.003 per call; override with `LLM_MODEL`). Set
`ASSEMBLYAI_WEBHOOK_SECRET` to any random string (`openssl rand -hex 32`). Webhooks are only
registered when `NEXT_PUBLIC_APP_URL` is https; locally the status poll drives jobs instead.

### 3. Stripe
1. Products → create **Solo** ($39/mo recurring) and **Pro** ($79/mo recurring). Copy both price IDs.
2. Settings → Billing → Customer portal: enable it, and turn on **switch plans** with both prices
   (subscribers upgrade/downgrade there; a second Checkout is blocked to avoid double billing).
3. Webhook (after deploy): Developers → Webhooks → add endpoint
   `https://YOUR-DOMAIN/api/stripe/webhook` with events
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret.

Local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### 4. Run locally
```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

### 4b. Background sweeper (required in production)
Picks up missed webhooks, retries and abandoned uploads (refunds unfinished uploads after 3h).
- **Free option:** Supabase → Database → Extensions: enable `pg_cron` and `pg_net`, then run the
  commented `cron.schedule(...)` block at the bottom of `schema.sql` with your domain and `CRON_SECRET`.
- **Vercel Pro:** add `{"crons":[{"path":"/api/cron/sweep","schedule":"* * * * *"}]}` to `vercel.json`.
  Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. (Hobby only allows daily crons.)

## Deploy to Vercel
1. Push this repo to GitHub.
2. vercel.com → Add New Project → import the repo (framework auto-detected).
3. Add every variable from `.env.example`; set `NEXT_PUBLIC_APP_URL` to the production URL.
4. Deploy. Then add the Stripe webhook (step 3.3) and Supabase redirect URL (step 1.3) for that domain.

Generation routes set `maxDuration = 300` and LLM calls time out at 240 s. On Vercel Hobby
functions stop at 60 s: typical calls finish in time, but very long transcripts will fail after
3 attempts (no runaway cost). Use Vercel Pro for 2h+ calls.

## Security model
- RLS: users can `select` their own rows only; no insert/update/delete grants on `calls`,
  `call_outputs`, `usage_events`. Profile updates limited to business fields by column grant.
- RPCs (`create_call`, `claim_call`, `regenerate_call`, `next_invoice_number`) are service-role only.
- Storage: no user write policies; uploads use server-issued signed upload URLs for server-chosen paths.
  Bucket restricted to `audio/*` and `video/*`. Recordings deleted after transcription.
- CSRF: non-GET `/api/*` requests must carry a same-origin `Origin` header (middleware).
- Open redirects blocked by resolving `next` and comparing origins.
- Transcripts are treated as untrusted data in the prompt; outputs are zod-validated and shown with
  an "AI draft, review before sending" notice.

## Unit economics (per 1-hour call)
- Transcription (`universal-2` + speaker labels): $0.17
- Generation (`claude-haiku-5-5` via LLM Gateway, ~15k input + ~3k output tokens): ~$0.003
- **≈ $0.17 per call** → Solo at 25 calls ≈ $4.30 cost on $39 revenue worst case.

## Project layout
```
supabase/schema.sql            DB, RLS, storage bucket
src/lib/ai.ts                  Prompt + JSON schema (tool use) via AssemblyAI LLM Gateway
src/lib/transcribe.ts          AssemblyAI submit/check
src/lib/pipeline.ts            Job state machine + sweeper
src/lib/schemas.ts             zod schemas for AI output and user edits
src/lib/quota.ts, plans.ts     Plan limits
src/app/api/...                Calls, profile, Stripe checkout/portal/webhook
src/app/calls/[id]/CallView.tsx Proposal / action items / invoice / transcript views
```

## Next steps after MVP
- Stripe payment links on invoices
- Server-side PDF generation and email sending (Resend)
- Version history UI (data already stored in `call_outputs`)
- Zoom / Google Meet import
- Custom proposal templates and branding (logo)
