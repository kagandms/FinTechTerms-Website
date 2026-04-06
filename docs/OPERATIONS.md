# Operations Runbook

## Release checklist

1. Confirm the rollout uses only `supabase/migrations/` as the shared schema source of truth.
2. Do not apply `lib/*.sql` or `telegram-bot/migrations/*.sql` against preview/staging/production.
3. Confirm runtime env includes `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STUDY_SESSION_TOKEN_SECRET`, `OPENROUTER_API_KEY`, `AI_PRIMARY_MODEL`, `AI_FALLBACK_MODELS`, `ADMIN_USER_IDS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `NEXT_PUBLIC_SENTRY_DSN`.
4. Confirm preview/staging gate secrets include `STAGING_BASE_URL`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STUDY_SESSION_TOKEN_SECRET`, `ADMIN_USER_IDS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`, `SENTRY_SMOKE_EMAIL`, and `SENTRY_SMOKE_PASSWORD`.
   `STUDY_SESSION_TOKEN_SECRET` must be a dedicated high-entropy server secret, never a reused API key.
5. Keep local secret files such as `.env.local`, `telegram-bot/.env`, and `.vercel/.env*` out of deployment artifacts, screenshots, archives, and support bundles. Workspace-local secrets are not an acceptable release input.
6. Run `npm run guard:local-secrets` and stop immediately if the workspace contains forbidden local secret files or any tracked non-example `.env*` file.
7. Run `npm run validate:runtime-env` and stop immediately if any runtime key is missing, placeholder, or malformed.
8. Run `npm run validate:release-gate-env` before any preview/staging release verification, including automatic PR/main gates and manual re-runs.
9. Run `npm audit --omit=dev`.
10. Run the clean bootstrap smoke against a disposable database with `BOOTSTRAP_DB_URL` or `DATABASE_URL` set: `npm run verify:bootstrap-db`.
11. Run `npm run typecheck`.
12. Run `npm run lint`.
13. Run `npm run verify:sql-sources`.
14. Run `npm test -- --ci --runInBand --detectOpenHandles`.
15. Run `npm run build`.
16. Verify the committed PWA asset exists after build/start assumptions: `/public/sw.js` must remain present and the app must still register `/sw.js`.
17. Run `python3 -m pip_audit -r telegram-bot/requirements.txt --format json --disable-pip`.
18. Build the Telegram bot container and run `python -m bot.validate_runtime` inside the image with production-style env values before any deploy approval.
19. Apply migrations to staging with `supabase db push --include-all --db-url "$SUPABASE_DB_URL"` when the remote migration history predates the canonical baseline entry.
20. Run `npm run verify:release-db` and require both DB readiness checks and repo-term mirror checks to pass.
21. Run `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:guest`.
22. Run `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:auth`.
23. Run `STAGING_BASE_URL="$STAGING_BASE_URL" npm run smoke:staging`.
24. Verify the admin Sentry smoke event arrives with `requestId`, `environment`, and `smoke=true`.
25. Verify admin analytics pages render with live aggregated data and no sample-window assumptions.
26. Verify profile saves go only through `POST /api/profile`, and the client never performs direct profile/auth dual writes.
27. Verify retryable quiz reviews persist in the device queue and replay successfully after reconnect or re-authentication.
28. Verify preview release gates fail on same-repo pull requests when required staging secrets are missing.

## Rollback

1. Roll back the Vercel deployment to the previous healthy release.
2. If the incident is schema-related, stop traffic before applying any reverse migration.
3. Re-run the smoke suite against the rolled-back deployment:
   `verify:bootstrap-db`, `verify:release-db`, guest Playwright, auth Playwright, staging smoke.
4. Check Sentry for error volume returning to baseline before closing the incident.

## Final sign-off

Release may be signed off only when all of the following are true:

- runtime env validation, release-gate env validation, typecheck, lint, unit tests, and build are green
- Node production dependency audit is green
- Telegram bot `pip_audit` is green
- bootstrap DB verification is green on a disposable database
- staging DB verification is green against the real target schema and the repo term corpus matches `public.terms`
- guest/auth E2E and staging smoke are green
- staging/production write-path rate limiting is backed by Upstash Redis
- browser/server error capture is wired through Sentry (`NEXT_PUBLIC_SENTRY_DSN`)
- study-session runtime secret is configured in the preview/staging runtime (`STUDY_SESSION_TOKEN_SECRET`)
- service worker runtime asset is present and registered
- Telegram bot readiness endpoint is green because the bot loop heartbeat is fresh, not merely because the Flask sidecar is listening
- critical backlog items are closed; any remaining warnings are explicitly accepted in writing

## Supabase outage handling

1. Treat auth or RPC failures as degraded mode, not silent success.
2. Keep the public catalog available from the repo-backed corpus.
3. Disable risky write paths if service-role RPCs or session writes start failing repeatedly; `study-sessions` should return a non-retryable disabled response.
4. If quiz review replay starts accumulating in the device queue, stop the rollout and investigate before queue growth causes user-visible lag or dropped retries.
5. Communicate degraded behavior in the app and status channels until Supabase recovers.

## Alert triage

1. Use `requestId`, route name, and user id from structured logs/Sentry to isolate the failing path.
2. Prioritize `record-quiz`, `study-sessions`, and auth failures before non-critical UI errors.
3. If stale content appears, verify the active service worker version and clear old caches before deeper investigation.
4. During the first 30-60 minutes after rollout, watch `record-quiz`, `favorites`, `study-sessions`, AI routes, bot readiness, and new Sentry error groups before widening traffic.
