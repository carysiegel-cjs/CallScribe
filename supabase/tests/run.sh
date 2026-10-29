#!/usr/bin/env bash
# Runs the schema tests against an empty Postgres. Usage: PGHOST=... PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")"
PSQL="psql -v ON_ERROR_STOP=1 -q -X"

$PSQL -f 00_supabase_stubs.sql
$PSQL -f ../schema.sql
$PSQL -f 10_schema_test.sql

# Race: 8 simultaneous creates against a 3-call quota must yield exactly 3 calls.
U=33333333-3333-3333-3333-333333333333
$PSQL -c "insert into auth.users (id) values ('$U')"
for i in $(seq 1 8); do
  $PSQL -c "set role service_role; select create_call('$U','r$i',null,null,'tx','queued',3,true)" >/dev/null 2>&1 &
done
wait || true
n=$($PSQL -tA -c "select count(*) from calls where user_id = '$U'")
if [ "$n" != "3" ]; then echo "FAILED: concurrent quota allowed $n calls (expected 3)"; exit 1; fi
echo "ok: concurrent creates respect quota"
echo "All schema tests passed."
