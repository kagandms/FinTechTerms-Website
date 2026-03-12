# Operations Runbook

## Release checklist

1. Confirm preview/staging secrets include `STAGING_BASE_URL`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, and Sentry credentials.
2. Run `npm run lint`.
3. Run `npm test -- --ci --runInBand --detectOpenHandles`.
4. Run `npm run build`.
5. Apply migrations to staging with `supabase db push --db-url "$SUPABASE_DB_URL" --yes`.
6. Run `npm run verify:release-db`.
7. Run `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:guest`.
8. Run `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:auth`.
9. Run `STAGING_BASE_URL="$STAGING_BASE_URL" npm run smoke:staging`.
10. Verify the admin Sentry smoke event arrives with `requestId`, `environment`, and `smoke=true`.

## Rollback

1. Roll back the Vercel deployment to the previous healthy release.
2. If the incident is schema-related, stop traffic before applying any reverse migration.
3. Re-run the smoke suite against the rolled-back deployment:
   `verify:release-db`, guest Playwright, auth Playwright, staging smoke.
4. Check Sentry for error volume returning to baseline before closing the incident.

## Supabase outage handling

1. Treat auth or RPC failures as degraded mode, not silent success.
2. Keep the public catalog available from the repo-backed corpus.
3. Disable risky write paths if service-role RPCs or session writes start failing repeatedly; `study-sessions` should return a non-retryable disabled response.
4. Communicate degraded behavior in the app and status channels until Supabase recovers.

## Alert triage

1. Use `requestId`, route name, and user id from structured logs/Sentry to isolate the failing path.
2. Prioritize `record-quiz`, `study-sessions`, and auth failures before non-critical UI errors.
3. If stale content appears, verify the active service worker version and clear old caches before deeper investigation.
