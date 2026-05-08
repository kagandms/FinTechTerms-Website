# Operations Runbook

## Release checklist

1. Confirm the rollout uses only `supabase/migrations/` as the shared schema source of truth.
2. Do not apply `lib/*.sql` or `telegram-bot/migrations/*.sql` against preview/staging/production.
3. Treat the repo-backed curated catalog as the canonical public term mirror. The current release corpus is 956 terms; staging may hard-prune extra `public.terms` rows during release verification.
4. Confirm runtime env includes `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STUDY_SESSION_TOKEN_SECRET`, `OPENROUTER_API_KEY`, `AI_PRIMARY_MODEL`, `AI_FALLBACK_MODELS`, `ADMIN_USER_IDS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `NEXT_PUBLIC_SENTRY_DSN`.
5. Confirm preview/staging gate secrets include `NEXT_PUBLIC_SITE_URL`, `STAGING_BASE_URL`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STUDY_SESSION_TOKEN_SECRET`, `OPENROUTER_API_KEY`, `AI_PRIMARY_MODEL`, `AI_FALLBACK_MODELS`, `ADMIN_USER_IDS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`, `SENTRY_SMOKE_EMAIL`, and `SENTRY_SMOKE_PASSWORD`.
   The Supabase Auth user id for `SENTRY_SMOKE_EMAIL` must be included in the Vercel preview runtime `ADMIN_USER_IDS` value before the Sentry smoke gate can pass.
   Add `SMOKE_AUTH_EMAIL` and `SMOKE_AUTH_PASSWORD` when member-only preview probes should avoid coupling to the baseline authenticated E2E user.
   `STUDY_SESSION_TOKEN_SECRET` must be a dedicated high-entropy server secret, never a reused API key.
6. Confirm any Supabase Storage buckets containing user-linked files are private or policy-scoped to the owning user. No user-specific bucket should be public-by-default at release time.
7. Keep local secret files such as `.env.local`, `telegram-bot/.env`, and `.vercel/.env*` out of deployment artifacts, screenshots, archives, and support bundles. Workspace-local secrets are not an acceptable release input.
8. Run `npm run guard:local-secrets` and stop immediately if the workspace contains forbidden local secret files or any tracked non-example `.env*` file.
9. Run `npm run validate:runtime-env` and stop immediately if any runtime key is missing, placeholder, or malformed.
10. Run `npm run validate:release-gate-env` before any preview/staging release verification, including automatic PR/main gates and manual re-runs.
11. Run `npm audit --omit=dev`.
12. Run the clean bootstrap smoke against a disposable database with `BOOTSTRAP_DB_URL` or `DATABASE_URL` set: `npm run verify:bootstrap-db`.
13. Run `npm run typecheck`.
14. Run `npm run lint`.
15. Run `npm run verify:sql-sources`.
16. Run `npm test -- --ci --runInBand --detectOpenHandles`.
17. Run `npm run build`.
18. Verify the committed PWA asset exists after build/start assumptions: `/public/sw.js` must remain present and the app must still register `/sw.js`.
19. Run `python3 -m pip_audit -r telegram-bot/requirements.txt --format json --disable-pip`.
20. Build the Telegram bot container and run `python -m bot.validate_runtime` inside the image with production-style env values before any deploy approval.
21. Apply migrations to staging with `supabase db push --include-all --db-url "$SUPABASE_DB_URL"` when the remote migration history predates the canonical baseline entry.
22. Run `node scripts/sync_repo_terms.js --dry-run --prune-extra` and review the structured impact report before destructive staging sync.
23. Run `ALLOW_REMOTE_DESTRUCTIVE_SCRIPTS=1 node scripts/sync_repo_terms.js --prune-extra` against staging only.
24. Run `npm run verify:release-db` and require both DB readiness checks and repo-term mirror checks to pass.
25. Run `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:guest`.
26. Run `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:auth`.
27. Run `STAGING_BASE_URL="$STAGING_BASE_URL" npm run smoke:staging`.
28. Verify the admin Sentry smoke event arrives with `requestId`, `environment`, and `smoke=true`.
29. Verify admin analytics pages render with live aggregated data and no sample-window assumptions.
30. Verify profile saves go only through `POST /api/profile`, and the client never performs direct profile/auth dual writes.
31. Verify retryable quiz reviews persist in the device queue and replay successfully after reconnect or re-authentication.
32. Verify preview release gates fail on same-repo pull requests when required staging secrets are missing.
33. Verify local development and production build parity by running the explicit webpack paths: `npm run dev` and `npm run build`.
34. Before packaging any support bundle or exported debug archive, run `npm run guard:artifact-sourcemaps -- path/to/artifact-manifest.txt` against the candidate file list or unzip listing.
35. Never ship or attach `.next/server/**/*.map` files to support bundles, exported debug archives, or customer-visible artifacts; treat server source maps as internal deployment-only material.

Validation note:

- `validate:runtime-env`, `validate:release-gate-env`, and `verify:release-db` must not derive release truth from workspace `.env.local` or `.env`.
- Local secret files may be used only with the explicit override `ALLOW_LOCAL_ENV_VALIDATION=1` for a developer dry run.
- That override is forbidden in CI, preview, staging, and production approval workflows.
- Production term hard-prune is forbidden without a fresh `sync_repo_terms --dry-run --prune-extra` impact report, a verified database backup or rollback plan, and explicit release-owner approval.

## Rollback

1. Roll back the Vercel deployment to the previous healthy release.
2. If the incident is schema-related, stop traffic before applying any reverse migration.
3. Re-run the smoke suite against the rolled-back deployment:
   `verify:bootstrap-db`, `verify:release-db`, guest Playwright, auth Playwright, staging smoke.
4. Check Sentry for error volume returning to baseline before closing the incident.

## Destructive scripts

- Scripts guarded by `scripts/destructive_target_guard.py` refuse to touch remote Supabase targets unless `ALLOW_REMOTE_DESTRUCTIVE_SCRIPTS=1` is set explicitly.
- Leave `ALLOW_REMOTE_DESTRUCTIVE_SCRIPTS=0` for normal development, CI, and release verification.
- Raise it only for an intentional, reviewed maintenance window, and unset it immediately afterwards.

## Final sign-off

Release may be signed off only when all of the following are true:

- runtime env validation, release-gate env validation, same-repo/protected CI runtime-secret enforcement, typecheck, lint, unit tests, and build are green
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

## Alert thresholds

Configure Sentry/Vercel alert policies before widening staging or production traffic. Every alert must preserve `route`, `requestId` when emitted by an API route, metric name, threshold, and the first response step in the alert description.

| Alert | Source metric | Threshold | Required fields | First response step |
| --- | --- | --- | --- | --- |
| API route p95 latency | `API_ROUTE_COMPLETED.duration_ms` grouped by `route` | p95 > 1500 ms for 10 minutes | `route`, `requestId`, `status`; example `route=/api/progress requestId=req-progress-p95-example` | Open structured logs for the sample `requestId`, then compare same-window `UPSTREAM_REQUEST_COMPLETED` events for Supabase/OpenRouter attribution. |
| API route p99 latency | `API_ROUTE_COMPLETED.duration_ms` grouped by `route` | p99 > 2500 ms for 5 minutes | `route`, `requestId`, `status`; example `route=/api/study-sessions requestId=req-study-p99-example` | Check whether the route has concentrated 5xx/429 responses before treating it as pure latency. |
| API route error rate | `API_ROUTE_COMPLETED.status` grouped by `route` | 5xx rate > 2% for 10 minutes, or any auth/study write route > 5 errors in 5 minutes | `route`, `requestId`, `status`; example `route=/api/record-quiz requestId=req-record-error-example` | Pull the first failing `requestId`, inspect wrapped error context, and decide rollback vs dependency degradation. |
| Supabase dependency latency | `UPSTREAM_REQUEST_COMPLETED.duration_ms` where `dependency=supabase` | p95 > 800 ms for 10 minutes or timeout outcome count > 0 | `dependency`, `route`, `requestId`, `status`, `outcome` | Compare affected routes; if writes are failing, disable risky study writes before retry queues grow. |
| OpenRouter dependency latency | `UPSTREAM_REQUEST_COMPLETED.duration_ms` where `dependency=openrouter` | p95 > 15000 ms for 10 minutes, timeout outcome count > 0, or fallback model rate > 20% | `dependency`, `route`, `requestId`, `status`, `outcome` | Verify provider/model status and confirm AI endpoints are serving explicit degraded responses, not hanging. |
| Study session retry queue depth | `SESSION_TRACKER_RETRY_QUEUE_ENQUEUED.queueDepth` | `queueDepth >= 10` once, or `queueDepth > 0` for 15 minutes after recovery | `route=SessionTracker`, `queueDepth`, `maxRetryQueueSize`, `action`, `idempotencyKey` | Inspect `/api/study-sessions` 429/5xx events and pause rollout if queue depth keeps rising. |
| Quiz review queue depth | `SRS_PENDING_REVIEW_QUEUE_DEPTH.queueDepth` | `queueDepth >= 10` once, or `queueDepth > 0` for 15 minutes after recovery | `route=SRSContext`, `userId`, `reviewId`, `queueDepth`, `maxPendingReviewQueueSize` | Inspect `/api/record-quiz` and auth-refresh failures before allowing more quiz traffic. |

## Alert triage

1. Start from the firing metric name: `API_ROUTE_COMPLETED`, `UPSTREAM_REQUEST_COMPLETED`, `SESSION_TRACKER_RETRY_QUEUE_ENQUEUED`, or `SRS_PENDING_REVIEW_QUEUE_DEPTH`.
2. Use `requestId`, route name, and user id from structured logs/Sentry to isolate the failing path.
3. Prioritize `record-quiz`, `study-sessions`, and auth failures before non-critical UI errors.
4. If stale content appears, verify the active service worker version and clear old caches before deeper investigation.
5. During the first 30-60 minutes after rollout, watch `record-quiz`, `favorites`, `study-sessions`, AI routes, bot readiness, and new Sentry error groups before widening traffic.
