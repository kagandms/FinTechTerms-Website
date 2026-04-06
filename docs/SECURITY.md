# Security & Threat Model

## Canonical schema and deployment boundary

- Shared production schema changes are owned only by `supabase/migrations/`.
- `lib/*.sql` files are archived references for diagnostics and historical context.
- `telegram-bot/migrations/*.sql` files are historical bot-side snapshots and must not be applied to the shared production database.

## Supabase anon key exposure

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally exposed to the browser. This is acceptable only because:

- public catalog reads stay behind RLS and read-only grants
- sensitive mutation paths are resolved server-side
- service-role credentials never ship to client bundles

Current production mutation model:

- `/api/record-quiz` authenticates the caller server-side, then writes through a service-role route boundary (`record_study_event`) with the user id derived from the request
- `/api/favorites` authenticates the caller server-side and writes through a service-role route boundary (`toggle_user_favorite`) with the user id derived from the request
- `/api/study-sessions` writes only through service-role server RPCs and durable session tokens
- `/api/profile` authenticates the caller server-side, then updates `profiles` plus auth metadata through a single trusted route boundary

The anon key must never be treated as sufficient authority for user-owned write tables.

## Secret handling

Local secret files such as `.env.local`, `telegram-bot/.env`, and `.vercel/.env*` may exist for developer convenience, but they must be treated as workstation-only material:

- never package them into deploy artifacts or support bundles
- never rely on them as the production source of truth
- never share screenshots, archives, or logs that could expose their contents

## RLS posture

The repo no longer assumes that every authenticated client may write directly to every self-owned row. Current expected trust boundary is:

- `terms`: public read, no client writes
- `profiles`: authenticated self read/update
- `user_progress`, `quiz_attempts`, `user_term_srs`, `daily_learning_logs`, `user_badges`: client reads only where granted; canonical writes must flow through trusted routes/RPCs
- `user_favorites`: authenticated read, trusted backend mutation path
- `study_sessions`: authenticated read of owned rows, trusted backend write path

If a future change re-enables broad authenticated writes on analytics/gamification tables, that is a security regression and must be reviewed explicitly.

## Idempotency and abuse resistance

Write-heavy routes use durable or ephemeral idempotency plus rate limiting. Production expectations:

- idempotent replays must resolve before rate-limit rejection for duplicate successful requests
- rate limits must still apply to genuinely new write attempts
- trusted route mutations must derive user identity from the authenticated request, never from arbitrary body input
- browser retry queues must only claim durability when the payload is actually persisted in device storage

## Browser storage

The browser stores:

- `globalfinterm_terms`
- `globalfinterm_user_progress`
- `globalfinterm_language`

No credentials or service-role secrets are stored there. The main residual risk remains XSS. CSP headers and server-rendered boundaries are part of that mitigation, but browser storage must still be treated as untrusted input on read.

## PWA/service worker contract

`/public/sw.js` is a committed runtime asset and part of the security/performance boundary. Clean deploys must expose `/sw.js`; treating it as an optional generated artifact is not acceptable because that silently changes caching/offline behavior between environments.
