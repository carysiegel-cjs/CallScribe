-- CallScribe schema. Run once in Supabase SQL Editor on a fresh project.
--
-- Security model: users can READ their own rows. All writes to calls, usage and
-- billing columns go through the server (service role) so quota, plan and job
-- state cannot be tampered with from the browser.

-- Profiles ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  business_name text,
  business_address text,
  hourly_rate numeric default 150 check (hourly_rate >= 0),
  currency text default 'USD' check (currency ~ '^[A-Z]{3}$'),
  payment_terms_days int default 14 check (payment_terms_days between 0 and 365),
  next_invoice_no int not null default 1,
  plan text not null default 'free' check (plan in ('free', 'solo', 'pro')),
  subscription_status text default 'inactive',
  stripe_customer_id text unique,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

revoke insert, update, delete on public.profiles from authenticated, anon;
grant update (business_name, business_address, hourly_rate, currency, payment_terms_days)
  on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Calls ---------------------------------------------------------------------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  client_name text,
  client_email text,
  -- uploading -> transcribing -> queued -> generating -> ready | error
  status text not null default 'queued'
    check (status in ('uploading', 'transcribing', 'queued', 'generating', 'ready', 'error')),
  audio_path text,
  audio_deleted_at timestamptz,
  assemblyai_id text unique,
  transcript text,
  summary text,
  proposal jsonb,
  action_items jsonb,
  invoice jsonb,
  invoice_number int,
  amount_total numeric,
  error text,
  -- job control
  attempts int not null default 0,
  regen_count int not null default 0,
  claim_token uuid,
  next_attempt_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, invoice_number)
);

create index if not exists calls_user_created on public.calls (user_id, created_at desc);
create index if not exists calls_pending on public.calls (status, updated_at)
  where status in ('uploading', 'transcribing', 'queued', 'generating');

alter table public.calls enable row level security;
create policy "own calls select" on public.calls for select using (auth.uid() = user_id);
revoke insert, update, delete on public.calls from authenticated, anon;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists calls_touch on public.calls;
create trigger calls_touch before update on public.calls
  for each row execute function public.touch_updated_at();

-- Output history: every generation and manual edit is kept ----------------
create table if not exists public.call_outputs (
  id bigserial primary key,
  call_id uuid not null references public.calls on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  source text not null check (source in ('generate', 'edit')),
  summary text,
  proposal jsonb,
  action_items jsonb,
  invoice jsonb,
  model text,
  created_at timestamptz default now()
);
create index if not exists call_outputs_call on public.call_outputs (call_id, created_at desc);
alter table public.call_outputs enable row level security;
create policy "own outputs select" on public.call_outputs for select using (auth.uid() = user_id);
revoke insert, update, delete on public.call_outputs from authenticated, anon;

-- Usage ledger: append-only, survives call deletion -----------------------
create table if not exists public.usage_events (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  call_id uuid,   -- no FK: deleting a call must not delete its usage
  kind text not null check (kind in ('call', 'regenerate')),
  created_at timestamptz default now()
);
create index if not exists usage_user_created on public.usage_events (user_id, created_at);
alter table public.usage_events enable row level security;
create policy "own usage select" on public.usage_events for select using (auth.uid() = user_id);
revoke insert, update, delete on public.usage_events from authenticated, anon;

-- RPCs (service role only) ------------------------------------------------

-- Atomically enforce quota, record usage and create the call.
create or replace function public.create_call(
  p_user uuid, p_title text, p_client_name text, p_client_email text,
  p_transcript text, p_status text, p_limit int, p_lifetime boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  used int;
  new_id uuid;
begin
  perform 1 from profiles where id = p_user for update;  -- serialize per user
  if p_limit is not null then
    select count(*) into used from usage_events
      where user_id = p_user and kind = 'call'
        and (p_lifetime or created_at >= date_trunc('month', now()));
    if used >= p_limit then raise exception 'quota_exceeded'; end if;
  end if;
  insert into calls (user_id, title, client_name, client_email, transcript, status)
    values (p_user, p_title, p_client_name, p_client_email, p_transcript, p_status)
    returning id into new_id;
  insert into usage_events (user_id, call_id, kind) values (p_user, new_id, 'call');
  return new_id;
end $$;

-- Claim a call for generation. Returns the row, or nothing if not claimable.
-- Gives up after p_max_attempts so a call that keeps timing out stops costing money.
create or replace function public.claim_call(p_id uuid, p_stale_seconds int, p_max_attempts int)
returns setof calls language plpgsql security definer set search_path = public as $$
begin
  update calls set status = 'error', error = 'Generation failed after several attempts. Try Regenerate.'
    where id = p_id and attempts >= p_max_attempts
      and (status = 'queued' or (status = 'generating' and updated_at < now() - make_interval(secs => p_stale_seconds)));
  return query
    update calls set status = 'generating', claim_token = gen_random_uuid(), attempts = attempts + 1, error = null
    where id = p_id and attempts < p_max_attempts
      and ((status = 'queued' and coalesce(next_attempt_at, now()) <= now())
        or (status = 'generating' and updated_at < now() - make_interval(secs => p_stale_seconds)))
    returning *;
end $$;

create or replace function public.regenerate_call(p_user uuid, p_id uuid, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update calls set status = 'queued', regen_count = regen_count + 1, attempts = 0,
                   next_attempt_at = null, error = null
    where id = p_id and user_id = p_user and status in ('ready', 'error')
      and transcript is not null and regen_count < p_max;
  if not found then return false; end if;
  insert into usage_events (user_id, call_id, kind) values (p_user, p_id, 'regenerate');
  return true;
end $$;

-- Sequential per-user invoice numbers.
create or replace function public.next_invoice_number(p_user uuid)
returns int language sql security definer set search_path = public as $$
  update profiles set next_invoice_no = next_invoice_no + 1 where id = p_user
  returning next_invoice_no - 1;
$$;

revoke execute on function public.create_call, public.claim_call, public.regenerate_call,
  public.next_invoice_number from public, anon, authenticated;

-- Storage: private bucket. Users never write directly; the server issues
-- single-use signed upload URLs for a path it chooses.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 209715200,  -- 200 MB
        array['audio/*', 'video/*'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Optional: background sweeper every minute (needs pg_cron + pg_net enabled
-- in Database -> Extensions). Replace URL and secret, then run:
--
-- select cron.schedule('callscribe-sweep', '* * * * *', $$
--   select net.http_post(
--     url := 'https://YOUR-DOMAIN/api/cron/sweep',
--     headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
--   );
-- $$);
