#!/usr/bin/env bash
# Tests the migrations on a throwaway local Postgres with stand-ins for the Supabase roles.
set -euo pipefail
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
DIR=$(mktemp -d)
"$PGBIN/initdb" -D "$DIR" -U postgres >/dev/null
"$PGBIN/pg_ctl" -D "$DIR" -o "-p 55432 -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
trap '"$PGBIN/pg_ctl" -D "$DIR" stop -m fast >/dev/null; rm -rf "$DIR"' EXIT
PSQL=(psql -h "$DIR" -p 55432 -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c 'create database t' >/dev/null
here=$(cd "$(dirname "$0")" && pwd)
"${PSQL[@]}" -d t -f "$here/auth-stub.sql"
for f in "$here"/../migrations/*.sql; do "${PSQL[@]}" -d t -f "$f"; done
"${PSQL[@]}" -d t -t -f "$here/rls-test.sql"
