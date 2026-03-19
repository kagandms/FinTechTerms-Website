# Operations Runbook

## Release checklist

1. Confirm the rollout uses only `supabase/migrations/` as the shared schema source of truth.
2. Do not apply `lib/*.sql` or `telegram-bot/migrations/*.sql` against preview/staging/production.
3. Confirm preview/staging secrets and runtime env include `STAGING_BASE_URL`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`, optional `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, and Sentry credentials.
4. Run `npm run validate:release-env` and stop immediately if any key is missing, placeholder, or malformed.
5. Run the clean bootstrap smoke against a disposable database with `BOOTSTRAP_DB_URL` or `DATABASE_URL` set: `npm run verify:bootstrap-db`.
6. Run `npm run lint`.
7. Run `npm test -- --ci --runInBand --detectOpenHandles`.
8. Run `npm run build`.
9. Verify the committed PWA asset exists after build/start assumptions: `/public/sw.js` must remain present and the app must still register `/sw.js`.
10. Apply migrations to staging with `supabase db push --db-url "$SUPABASE_DB_URL" --yes`.
11. Run `npm run verify:release-db`.
12. Run `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:guest`.
13. Run `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:auth`.
14. Run `STAGING_BASE_URL="$STAGING_BASE_URL" npm run smoke:staging`.
15. Verify the admin Sentry smoke event arrives with `requestId`, `environment`, and `smoke=true`.
16. Verify admin analytics pages render with live data and no legacy `session_id` migration fallback messaging.

## Rollback

1. Roll back the Vercel deployment to the previous healthy release.
2. If the incident is schema-related, stop traffic before applying any reverse migration.
3. Re-run the smoke suite against the rolled-back deployment:
   `verify:bootstrap-db`, `verify:release-db`, guest Playwright, auth Playwright, staging smoke.
4. Check Sentry for error volume returning to baseline before closing the incident.

## Final sign-off

Release may be signed off only when all of the following are true:

- local typecheck, lint, unit tests, and build are green
- bootstrap DB verification is green on a disposable database
- staging DB verification is green against the real target schema
- guest/auth E2E and staging smoke are green
- service worker runtime asset is present and registered
- critical backlog items are closed; any remaining warnings are explicitly accepted in writing

## Supabase outage handling

1. Treat auth or RPC failures as degraded mode, not silent success.
2. Keep the public catalog available from the repo-backed corpus.
3. Disable risky write paths if service-role RPCs or session writes start failing repeatedly; `study-sessions` should return a non-retryable disabled response.
4. Communicate degraded behavior in the app and status channels until Supabase recovers.

## Alert triage

1. Use `requestId`, route name, and user id from structured logs/Sentry to isolate the failing path.
2. Prioritize `record-quiz`, `study-sessions`, and auth failures before non-critical UI errors.
3. If stale content appears, verify the active service worker version and clear old caches before deeper investigation.
