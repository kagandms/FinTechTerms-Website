# Release Evidence — 2026-03-19

> Historical snapshot.
> This document preserves the release-gate state as of 2026-03-19.
> Current active commands have since been split into `npm run validate:runtime-env`
> and `npm run validate:release-gate-env`; any `validate:release-env` references
> below should be read as historical evidence, not current operator guidance.

## Summary

This evidence run validated the local codebase hardening changes and the bootstrap database migration chain. Local quality gates passed. Remote/staging gates remain blocked by missing or malformed runtime secrets in the current environment.

## Passed checks

- `npm run validate:release-env` was added as a release gate and now reports concrete environment failures.
- `npx tsc --noEmit`
- `npm run lint`
- `npm test -- --runInBand --detectOpenHandles`
- `python3 -m pytest telegram-bot/tests/test_bot.py -q`
- `NEXT_PUBLIC_SITE_URL=https://preview.fintechterms.app npm run build`
- `BOOTSTRAP_DB_URL=postgresql://<local-temp-postgres>/fintechterms_hardening2 npm run verify:bootstrap-db`

## Bootstrap DB result

- Migration chain applied successfully on a disposable PostgreSQL instance.
- `public.verify_release_readiness()` returned `ok: true`.
- New acceptance check `daily_learning_logs_time_spent_ms_column` passed.
- `authenticated_cannot_execute_record_study_event` passed after re-granting permissions in `20260318000000_production_hardening.sql`.

## Blocked checks

- `npm run verify:release-db`
  - Blocked in the current shell because local `NEXT_PUBLIC_SUPABASE_URL` is still not a real deployable project URL.
  - `npm run validate:release-env` now reports this as `NEXT_PUBLIC_SUPABASE_URL: invalid URL`.
- `npm run test:e2e:guest`
  - Blocked: `STAGING_BASE_URL` not available in the current environment.
- `npm run test:e2e:auth`
  - Blocked: `STAGING_BASE_URL`, `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD` not available in the current environment.
- `npm run smoke:staging`
  - Blocked: `STAGING_BASE_URL`, `SENTRY_SMOKE_EMAIL`, `SENTRY_SMOKE_PASSWORD` not available in the current environment.
- Shared rate-limit rollout proof
  - Blocked: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not set in the current environment.
- Admin allowlist rollout proof
  - Blocked: `ADMIN_USER_IDS` is not set in the current environment.
- `npm run validate:release-env`
  - Fails in the current environment with:
    - missing `STAGING_BASE_URL`
    - missing `NEXT_PUBLIC_SITE_URL`
    - invalid `NEXT_PUBLIC_SUPABASE_URL`
    - missing `ADMIN_USER_IDS`
    - missing `UPSTASH_REDIS_REST_URL`
    - missing `UPSTASH_REDIS_REST_TOKEN`
    - missing `NEXT_PUBLIC_SENTRY_DSN`
    - missing `E2E_AUTH_EMAIL`
    - missing `E2E_AUTH_PASSWORD`
    - missing `SENTRY_SMOKE_EMAIL`
    - missing `SENTRY_SMOKE_PASSWORD`

## What changed during validation

- Fixed `20260318000000_production_hardening.sql` so function recreation does not break bootstrap:
  - `drop function if exists public.get_user_learning_heatmap();`
  - explicit re-grants for:
    - `public.get_user_learning_heatmap()`
    - `public.increment_daily_learning_log(...)`
    - `public.merge_shadow_user_state(uuid, uuid)`
    - `public.record_study_event(...)`
- Updated preview gate wiring to require:
  - `ADMIN_USER_IDS`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Updated staging smoke script to stop depending on deprecated `ADMIN_EMAIL`.
- Added explicit URL validation in `scripts/verify-release-db.mjs` for better secret-quality failure reporting.
- Added `scripts/validate-release-env.mjs` and wired it into repo documentation as an explicit pre-release gate.
- Updated preview gate preflight to require `NEXT_PUBLIC_SENTRY_DSN` for Sentry smoke readiness.

## Remaining acceptance blockers for 8.5+

1. Provide valid staging/runtime secrets:
   - `STAGING_BASE_URL`
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_USER_IDS`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `SENTRY_SMOKE_EMAIL`
   - `SENTRY_SMOKE_PASSWORD`
   - optional auth smoke creds: `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`
2. Re-run:
   - `npm run verify:release-db`
   - `npm run test:e2e:guest`
   - `npm run test:e2e:auth`
   - `npm run smoke:staging`
3. Capture staging evidence:
   - admin-only dashboard access with allowlisted user id
   - centralized Upstash throttling behavior
   - Sentry smoke event id and tags
   - overlap merge scenario on a real staged dataset

## Current production-readiness interpretation

- Local code quality: strong
- Local bootstrap DB readiness: proven
- Remote/staging readiness: not yet proven
- Final score ceiling without staging evidence: below `8.5`
