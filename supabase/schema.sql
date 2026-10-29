-- CallScribe schema. Run once in Supabase SQL Editor.

-- Profiles ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  business_name text,
  business_address text,
  hourly_rate numeric default 150,
  currency text default 'USD',
  payment_terms_days int default 14,
  plan text not null default 'free',            -- free | solo | pro
  subscription_status text default 'inactive',  -- Stripe status
  stripe_customer_id text unique,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id);

-- Billing columns are written only by the server (service role).
revoke update on public.profiles from authenticated, anon;
grant update (business_name, business_address, hourly_rate, currency, payment_terms_days)
  on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;

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
  -- transcribing -> queued -> generating -> ready | error
  status text not null default 'queued',
  audio_path text,
  assemblyai_id text,
  transcript text,
  summary text,
  proposal jsonb,
  action_items jsonb,
  invoice jsonb,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists calls_user_created on public.calls (user_id, created_at desc);

alter table public.calls enable row level security;

create policy "own calls select" on public.calls for select using (auth.uid() = user_id);
create policy "own calls insert" on public.calls for insert with check (auth.uid() = user_id);
create policy "own calls update" on public.calls for update using (auth.uid() = user_id);
create policy "own calls delete" on public.calls for delete using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists calls_touch on public.calls;
create trigger calls_touch before update on public.calls
  for each row execute function public.touch_updated_at();

-- Storage: private bucket, each user owns the folder named after their id ---
insert into storage.buckets (id, name, public, file_size_limit)
values ('recordings', 'recordings', false, 524288000)  -- 500 MB
on conflict (id) do nothing;

create policy "upload own recordings" on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own recordings" on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own recordings" on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
