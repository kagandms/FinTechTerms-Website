#!/usr/bin/env bash
set -euo pipefail

DB_URL="${BOOTSTRAP_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "${DB_URL}" ]]; then
  echo "BOOTSTRAP_DB_URL or DATABASE_URL must be set." >&2
  exit 1
fi

psql "${DB_URL}" -v ON_ERROR_STOP=1 -f scripts/bootstrap_auth_schema.sql

while IFS= read -r migration; do
  echo "Applying ${migration}"
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${migration}"
done < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort)

psql "${DB_URL}" -v ON_ERROR_STOP=1 -c "select public.verify_release_readiness();"
