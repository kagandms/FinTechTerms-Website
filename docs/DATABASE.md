# Database Reference

## Canonical source of truth

- The database schema is versioned only in `supabase/migrations/`.
- The bootstrap entrypoint is `supabase/migrations/20260306000000_canonical_baseline.sql`.
- Files under `lib/*.sql` are historical references and must not be applied manually.
- Files under `telegram-bot/migrations/` are historical bot-side SQL snapshots, not the canonical shared schema for the web app.
- Never mix `lib/*.sql`, `telegram-bot/migrations/*.sql`, and `supabase/migrations/*.sql` in one rollout. Shared-environment schema changes must flow forward-only through `supabase/migrations/`.

## Core runtime tables

### `terms`
- Used by: web app, maintenance scripts, Telegram bot search/stats
- Access model: public read, service-role writes
- Notes: includes contest-ready SEO/editorial fields plus `search_terms_trigram(...)` support

### `profiles`
- Used by: profile page and profile edit form
- Access model: authenticated users can read/update their own row
- Notes: rows are mirrored from `auth.users` metadata and kept in sync via trigger

### `user_progress`
- Used by: authenticated learning-state sync and streak totals
- Access model: authenticated users can read/update their own row

### `user_favorites`
- Used by: favorite mutations, review eligibility, favorites page
- Access model: authenticated users can read their own rows, service role performs mutations

### `quiz_attempts`
- Used by: review persistence, analytics, admin simulation dashboards
- Access model: authenticated read, service-role write path for `record_study_event`
- Notes: includes `idempotency_key` and optional `session_id`
- Admin fatigue/distribution dashboards must not assume `session_id` is always populated; current production dashboards aggregate simulation attempts by user/day and by user accuracy.

### `user_term_srs`
- Used by: per-term spaced repetition state
- Access model: authenticated users can read/update their own rows

### `user_settings`
- Used by: preferred language and client settings sync
- Access model: authenticated users can read/update their own row

### `study_sessions`
- Used by: session analytics, heatmaps, admin dashboards
- Access model: authenticated read of own rows, service-role write path for `/api/study-sessions`
- Notes: includes durable idempotency keys and session token hashes
- Notes: `study_sessions` remains the canonical session analytics store, but quiz-attempt analytics must be resilient when a given quiz attempt is not back-linked through `quiz_attempts.session_id`

## Compatibility tables

### `daily_learning_log`
- Status: legacy compatibility table kept only so older migrations/functions remain bootstrap-safe
- New development target: `daily_learning_logs`

## Migration workflow

1. Add forward-only SQL under `supabase/migrations/`.
2. Keep new migrations idempotent when practical (`if exists` / `if not exists` / guarded updates).
3. Validate a clean bootstrap with `npm run verify:bootstrap-db`.
4. Validate release invariants with `npm run verify:release-db`.
5. Only then apply to staging/preview with `supabase db push --db-url ...`.
6. If the remote environment is older and does not yet contain the canonical baseline migration entry in `schema_migrations`, use `supabase db push --include-all --db-url ...` so the missing baseline can be applied before later repo migrations.
