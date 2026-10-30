-- Behavioural tests for schema.sql. Any failed assertion raises and stops psql (ON_ERROR_STOP).
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

-- Runs q as role r with the given user id; passes only if it is refused.
create function pg_temp.must_fail(q text, r text, uid text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin
    perform set_config('request.jwt.claim.sub', uid, true);
    execute format('set local role %I', r);
    execute q;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'expected % to be refused for role %', q, r; end if;
end $$;

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'a@example.com');
select pg_temp.check((select count(*) = 1 from profiles), 'profile created by signup trigger');

-- ---- End users cannot write anything that affects billing, quota or jobs ----
begin;
select pg_temp.must_fail($$update profiles set plan = 'pro'$$, 'authenticated', '11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail($$insert into calls (user_id, title) values ('11111111-1111-1111-1111-111111111111', 'x')$$, 'authenticated', '11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail($$update calls set status = 'queued'$$, 'authenticated', '11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail($$delete from usage_events$$, 'authenticated', '11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail($$select create_call('11111111-1111-1111-1111-111111111111', 't', null, null, 'x', 'queued', 3, true)$$, 'authenticated', '11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail($$select regenerate_call('11111111-1111-1111-1111-111111111111', gen_random_uuid(), 3)$$, 'authenticated', '11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail($$select next_invoice_number('11111111-1111-1111-1111-111111111111')$$, 'anon', '');
select pg_temp.check(true, 'users cannot change plan, calls, usage or call server functions');
commit;

select pg_temp.check(not has_function_privilege('anon', 'public.handle_new_user()', 'execute')
  and not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'handle_new_user not executable by clients');
select pg_temp.check((select proconfig @> array['search_path=public'] from pg_proc where oid = 'public.touch_updated_at'::regproc),
  'touch_updated_at has pinned search_path');

-- Users can still edit their own business details.
begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
update profiles set business_name = 'Acme' where id = '11111111-1111-1111-1111-111111111111';
commit;
select pg_temp.check((select business_name = 'Acme' from profiles), 'users can update their business details');
select pg_temp.must_fail($$update profiles set currency = 'US1'$$, 'postgres', '');
select pg_temp.check(true, 'invalid currency rejected');

-- ---- Quota (server role) ----
set role service_role;
select create_call('11111111-1111-1111-1111-111111111111', 'c1', null, null, 'tx', 'queued', 3, true) as c1 \gset
select create_call('11111111-1111-1111-1111-111111111111', 'c2', null, null, 'tx', 'queued', 3, true) as c2 \gset
select create_call('11111111-1111-1111-1111-111111111111', 'c3', null, null, 'tx', 'queued', 3, true);
reset role;
select pg_temp.must_fail($$select create_call('11111111-1111-1111-1111-111111111111', 'c4', null, null, 'tx', 'queued', 3, true)$$, 'service_role', '');
select pg_temp.check(true, '4th call on a 3-call plan refused');
delete from calls where id = :'c2';
select pg_temp.must_fail($$select create_call('11111111-1111-1111-1111-111111111111', 'c5', null, null, 'tx', 'queued', 3, true)$$, 'service_role', '');
select pg_temp.check(true, 'deleting a call does not give quota back');
set role service_role;
select pg_temp.check(create_call('11111111-1111-1111-1111-111111111111', 'c6', null, null, 'tx', 'queued', null, false) is not null, 'unlimited plan not capped');

-- ---- Job claiming ----
select pg_temp.check((select count(*) = 1 and min(attempts) = 1 from claim_call(:'c1', 360, 3)), 'first claim wins');
select pg_temp.check((select count(*) = 0 from claim_call(:'c1', 360, 3)), 'running job not claimed twice');
reset role;
alter table calls disable trigger calls_touch;
update calls set updated_at = now() - interval '10 minutes' where id = :'c1';
alter table calls enable trigger calls_touch;
set role service_role;
select pg_temp.check((select count(*) = 1 and min(attempts) = 2 from claim_call(:'c1', 360, 3)), 'stale job reclaimed');
reset role;
alter table calls disable trigger calls_touch;
update calls set updated_at = now() - interval '10 minutes', attempts = 3 where id = :'c1';
alter table calls enable trigger calls_touch;
set role service_role;
select pg_temp.check((select count(*) = 0 from claim_call(:'c1', 360, 3)), 'gives up after max attempts');
select pg_temp.check((select status = 'error' from calls where id = :'c1'), 'exhausted job marked error');

-- ---- Regenerate cap ----
select pg_temp.check(regenerate_call('11111111-1111-1111-1111-111111111111', :'c1', 3), 'regenerate 1');
update calls set status = 'ready' where id = :'c1';
select pg_temp.check(regenerate_call('11111111-1111-1111-1111-111111111111', :'c1', 3), 'regenerate 2');
update calls set status = 'ready' where id = :'c1';
select pg_temp.check(regenerate_call('11111111-1111-1111-1111-111111111111', :'c1', 3), 'regenerate 3');
update calls set status = 'ready' where id = :'c1';
select pg_temp.check(not regenerate_call('11111111-1111-1111-1111-111111111111', :'c1', 3), 'regenerate refused after 3');
select pg_temp.check(not regenerate_call('22222222-2222-2222-2222-222222222222', :'c1', 99), 'cannot regenerate another user''s call');

-- ---- Invoice numbers ----
select pg_temp.check((select next_invoice_number('11111111-1111-1111-1111-111111111111') = 1), 'first invoice number is 1');
select pg_temp.check((select next_invoice_number('11111111-1111-1111-1111-111111111111') = 2), 'invoice numbers are sequential');
reset role;
