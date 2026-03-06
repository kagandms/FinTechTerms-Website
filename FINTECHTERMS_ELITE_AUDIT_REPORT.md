# FinTechTerms Elite Audit Report

Audit date: 2026-03-06

Scope:
- Next.js 16 App Router web app
- Supabase schema, migrations, RLS, RPCs
- Python Telegram bot
- Term corpus and localization posture

Method:
- Static end-to-end code review only
- No application code modified
- No runtime migrations executed
- No test/build run, to keep the audit operationally read-only

## Executive Summary

FinTechTerms is not operating as a single coherent system yet. The repo contains multiple conflicting data models, a partially hardened Supabase layer, and a Russian-first business claim that is not consistently enforced in the actual product defaults.

The most serious problems are structural:
- The bot and web app do not share one stable source of truth for favorites and learning logs.
- Client-writable gamification tables let users fabricate streaks, heatmaps, and badges.
- Anonymous session RLS is effectively open.
- Legacy SQL files can reintroduce RLS bypasses and weak `SECURITY DEFINER` functions if applied out of order.
- Several user-visible flows still default to Turkish or English, despite the stated Russian-first strategy.

## Scorecard

| Category | Score |
|---|---:|
| 1. Database Security & Access Control | 38 / 100 |
| 2. Next.js/PWA Architecture & State Management | 52 / 100 |
| 3. Edge Cases, API Resilience & Bot Stability | 47 / 100 |
| 4. Business Logic, i18n & Financial Terminology Readiness | 41 / 100 |

## 1. Database Security & Access Control

Score: 38 / 100

### Findings

- Critical: `study_sessions` RLS exposes all anonymous research sessions to any caller that can hit the table.
  Evidence: `lib/study_sessions_schema.sql:55-75`
  Problem:
  - `SELECT` allows `user_id IS NULL AND anonymous_id IS NOT NULL`.
  - `UPDATE` allows the same condition.
  - `INSERT` is `WITH CHECK (true)`.
  Impact:
  - Anonymous research data is not anonymous in practice.
  - Any client can insert noise or overwrite anonymous session rows.

- Critical: Gamification trust boundary is wrong. Users can write the data that creates their own streaks and badges.
  Evidence: `supabase/migrations/20260306123000_gamification_rpc_and_triggers.sql:128-163`, `:238-292`
  Problem:
  - `daily_learning_logs` allows authenticated inserts/updates/deletes on self rows.
  - `user_badges` allows authenticated inserts on self rows.
  - `increment_daily_learning_log` is callable by `authenticated` and accepts arbitrary `p_log_date`.
  Impact:
  - A user can backfill activity for past days.
  - A user can mint badges directly.
  - Heatmap, streak, and achievement data are not trustworthy.

- High: The repo still ships a legacy migration that would reopen a broad RLS bypass on `telegram_users`.
  Evidence: `telegram-bot/migrations/003_telegram_web_sync.sql:16-22`
  Problem:
  - Policy is created without `TO service_role`.
  - In practical terms this is a public `USING (true) WITH CHECK (true)` policy if applied as written.
  Impact:
  - A manual SQL-editor deploy of the old migration would undo the hardening in `supabase/migrations/20260306143000_security_hardening.sql`.

- High: Legacy bot SQL still contains `SECURITY DEFINER` functions without an explicit `search_path`.
  Evidence: `telegram-bot/migrations/003_telegram_web_sync.sql:36-65`, `:69-145`; `telegram-bot/migrations/004_fix_telegram_link_rpc.sql:16-91`
  Problem:
  - The current hardened migration fixes this.
  - The legacy files remain deployable and are not clearly marked obsolete.
  Impact:
  - Operational regression risk is high, especially with manual Supabase SQL workflows.

- High: Telegram link tokens are too weak for an account-linking primitive.
  Evidence: `supabase/migrations/20260306143000_security_hardening.sql:126-165`, `:266-325`
  Problem:
  - Token entropy is only 6 numeric digits.
  - Tokens use `random()` rather than a cryptographic source.
  - Lockout is keyed to `web_user_id`, not token, Telegram ID, or a broader attack surface.
  Impact:
  - Brute-force cost is reduced.
  - An attacker can distribute guesses across accounts/devices/IPs.

- Medium: Lockout can still be front-run by concurrent invalid requests.
  Evidence: `supabase/migrations/20260306143000_security_hardening.sql:291-325` and trigger logic at `:84-124`
  Problem:
  - The function checks lockout before invalid-token insert.
  - Lockout is created after the failure insert path.
  - Several near-simultaneous bad attempts can enter before the lockout row exists.
  Impact:
  - The mechanism limits repeated abuse, but it does not strictly serialize the first burst.

- Medium: `/api/record-quiz` trusts a body-supplied `user_id`, yet writes through an anon-key client.
  Evidence: `app/api/record-quiz/route.ts:21-29`, `:102-145`
  Problem:
  - With current RLS, this route is likely nonfunctional because no authenticated JWT is attached.
  - If someone relaxes RLS to make it work, it immediately becomes a spoofable write endpoint.
  Impact:
  - Current state is either broken or one policy edit away from insecure.

### Recommendations

- Move `daily_learning_logs`, `user_badges`, and all streak/badge issuance behind service-only RPCs.
- Remove direct authenticated `INSERT/UPDATE/DELETE` on badge and activity tables.
- Replace anonymous-session RLS with a row secret or signed session token, not `anonymous_id IS NOT NULL`.
- Mark `telegram-bot/migrations/003_*.sql` and `004_*.sql` as obsolete, or remove them from deployable paths.
- Increase Telegram link token strength:
  - Use a cryptographic token.
  - Bind it to `telegram_id` and optionally target `web_user_id`.
  - Add attempt counters per token and per Telegram identity, not just per web user.
- Redesign `/api/record-quiz`:
  - Either use the caller’s Supabase JWT and let RLS enforce identity.
  - Or use a service-role route that resolves identity server-side and never accepts arbitrary `user_id`.

## 2. Next.js/PWA Architecture & State Management

Score: 52 / 100

### Findings

- High: Streak state is mutated on app load, not on study completion.
  Evidence: `contexts/SRSContext.tsx:201-213`, `lib/supabaseStorage.ts:274-315`
  Problem:
  - `updateStreakInSupabase()` runs during hydration.
  - It increments or resets streak based on page-open timing, not on immutable learning events.
  Impact:
  - Users can gain streak credit by opening the app.
  - Streak logic disagrees with the newer DB-driven heatmap/streak pipeline.

- High: PWA caching is aggressive while invalidation scope is too narrow.
  Evidence: `next.config.js:16-27`
  Problem:
  - `cacheOnFrontEndNav` and `aggressiveFrontEndNavCaching` are enabled.
  - Only profile/auth/telegram routes are forced `NetworkOnly`.
  Impact:
  - Public term pages, search, about, favorites, and methodology can remain stale after corpus or metadata updates.

- Medium: Session tracking does not persist the actual database session row id.
  Evidence: `components/SessionTracker.tsx:51-81`, `:101-149`
  Problem:
  - The client invents a local `sessionId`, but never stores the inserted Supabase row id.
  - Updates are attempted via `user_id`/`anonymous_id` filters plus `order(...).limit(1)`.
  Impact:
  - Session updates are not reliably targeted.
  - Historical rows can be overwritten or merged incorrectly.

- Medium: Favorite sync has a race window under rapid repeated clicks.
  Evidence: `contexts/SRSContext.tsx:263-300`
  Problem:
  - Server sync computes `newFavorites` from a captured `currentFavorites` array.
  - There is no in-flight lock.
  Impact:
  - Double taps can leave local and remote favorites out of sync.

- Medium: Dependency versions are skewed.
  Evidence: `package.json:25-27`, `:41-42`
  Problem:
  - `next` is `^16.1.1`.
  - `eslint-config-next` is still `^14.2.15`.
  Impact:
  - Tooling and framework expectations are drifting apart.
  - Lint results are not a reliable proxy for actual framework correctness.

- Low: Home-page recent-term selection memoizes only on array length, not content.
  Evidence: `app/HomeClient.tsx:30-34`
  Impact:
  - Term refreshes of equal length can keep showing stale cards.

### Recommendations

- Delete client-side streak mutation logic and derive streak only from server-trusted learning logs.
- Narrow PWA caching or add explicit revalidation tags/strategies for term corpus and metadata.
- Persist the inserted `study_sessions.id` and update by primary key only.
- Add in-flight guards around favorite toggles and other optimistic mutations.
- Align Next.js, React, and `eslint-config-next` versions to one supported matrix.
- Fix memo dependencies where UI content depends on array contents, not only counts.

## 3. Edge Cases, API Resilience & Bot Stability

Score: 47 / 100

### Findings

- High: The bot and web app are reading and writing different learning-log tables.
  Evidence:
  - Web/gamification pipeline: `supabase/migrations/20260306123000_gamification_rpc_and_triggers.sql:3-27`, `:181-236`, `:238-292`
  - Bot writes legacy table: `telegram-bot/bot/database.py:197-212`, `:343-345`, `:483-492`
  - Link merge still uses legacy table: `supabase/migrations/20260306143000_security_hardening.sql:364-386`, `:529-551`
  Problem:
  - Web heatmaps/badges read `daily_learning_logs`.
  - Bot reporting and merge logic still hit `daily_learning_log`.
  Impact:
  - Bot activity does not reliably appear in web gamification.
  - Account-link merge is incomplete against the current schema.

- High: The bot expects a `favorites` table that the checked-in schema does not define.
  Evidence:
  - Bot reads `favorites`: `telegram-bot/bot/database.py:403-460`, `:494-500`
  - Web stores favorites in `user_progress.favorites`: `lib/database_schema.sql:10-23`, `lib/supabaseStorage.ts:113-133`
  Problem:
  - Bot favorites/stats paths are implemented against a nonexistent or out-of-band table.
  Impact:
  - “Unified account” behavior is not actually unified.

- High: Quiz answer submission is not locked against double clicks.
  Evidence: `components/QuizCard.tsx:200-217`, `app/quiz/QuizClient.tsx:67-88`
  Problem:
  - Answer buttons remain active after first click.
  - `handleAnswer()` immediately writes stats and advances state asynchronously.
  Impact:
  - Duplicate quiz attempts can be recorded for the same card.
  - Daily logs and local progress can be inflated.

- Medium: Telegram pagination is not HTML-aware.
  Evidence: `telegram-bot/bot/handlers.py:240-270`, `:361-425`
  Problem:
  - `_chunk_text()` splits on spaces/newlines only.
  - Many bot messages use `ParseMode.HTML`.
  Impact:
  - Large formatted messages can be split inside tags or with unbalanced markup.
  - This can trigger `BadRequest` or silent formatting corruption near Telegram’s size limit.

- Medium: Retry handling is defensive, but not lossless.
  Evidence: `telegram-bot/bot/handlers.py:384-395`, `:1607-1623`
  Problem:
  - `RetryAfter` and `TimedOut` are caught.
  - The bot falls back to a busy message/alert instead of retrying or queueing.
  Impact:
  - It avoids crashes, but it still drops user intent under transient Telegram pressure.

- Medium: `/api/record-quiz` has route-level error handling, but its current auth/RLS design means resilience logic is wrapping an invalid trust model.
  Evidence: `app/api/record-quiz/route.ts:40-177`

- Medium: Profile-linked Telegram flows depend on a `profiles` table that is not present in the checked-in schema.
  Evidence: `app/profile/page.tsx:82-98`, `components/features/profile/ProfileEditForm.tsx:136-140`, `:195-202`, `app/api/telegram/link/route.ts:172-179`
  Impact:
  - Profile enrichment and unlink cleanup are partially best-effort rather than guaranteed.

### Recommendations

- Collapse bot and web analytics onto one canonical table set.
- Remove all bot references to a standalone `favorites` table unless that table is formally added, migrated, and owned.
- Add `isSubmitting` / `isPending` guards to quiz answer controls and other write-heavy UI actions.
- Replace `_chunk_text()` with an HTML-aware paginator or send plain-text paginated pages only.
- For Telegram `RetryAfter`, implement bounded retry with jitter for idempotent operations.
- Add integration tests for:
  - bot favorites/dashboard after account linking
  - long paginated HTML messages
  - double-click quiz submissions
  - `/api/record-quiz` under real RLS

## 4. Business Logic, i18n & Financial Terminology Readiness

Score: 41 / 100

### Findings

- High: Russian-first is not enforced as a system default.
  Evidence:
  - Manifest default language is Turkish: `public/manifest.json:4`, `:65`
  - Route metadata is Turkish-first on multiple pages:
    - `app/about/page.tsx:4-13`
    - `app/search/page.tsx:4-13`
    - `app/favorites/page.tsx:4-9`
    - `app/methodology/page.tsx:4-10`
  - DB default preferred language is Turkish: `lib/database_schema.sql:153-157`
  - Guest/default progress language is Turkish: `data/mockData.ts:11-20`
  - Cloud progress helpers also default to Turkish: `lib/supabaseStorage.ts:31-48`, `:74-80`
  Impact:
  - The product promise and actual behavior do not match.

- High: The auth UI reads the wrong storage key for language.
  Evidence:
  - `components/features/auth/AuthForm.tsx:10`, `:119`
  - `components/features/auth/UpdatePasswordForm.tsx:10`
  Problem:
  - These components read `localStorage.getItem('language')`.
  - The actual app key is `globalfinterm_language`.
  Impact:
  - Language-specific auth text can silently fall back to English or Russian instead of following the active app locale.

- High: The terminology schema is too flat for postgraduate finance/MIS coverage.
  Evidence:
  - Type model: `types/index.ts:14-54`
  - SQL schema: `lib/terms_schema.sql:6-29`
  Problem:
  - Only one `category`.
  - No aliases, abbreviations, jurisdiction, market, source, regulatory regime, related concepts, or concept hierarchy.
  Impact:
  - The current structure can store a translated glossary.
  - It cannot robustly model advanced cross-border financial terminology.

- High: Corpus coverage is not sufficient for the stated cross-border market brief.
  Audit observation:
  - Repository-wide corpus scan found no occurrences of `MOEX`, `BIST`, `Moscow Exchange`, or `Borsa Istanbul`.
  Impact:
  - The current data set does not support the specific market examples named in the audit brief.

- Medium: The term corpus already shows taxonomy drift.
  Audit observation:
  - Static corpus scan found 1,252 terms and at least 4 normalized English duplicates, including:
    - `Front Running` vs `Front-running`
    - `Bagholder` vs `Bag Holder`
    - `White Paper` vs `Whitepaper`
    - `Overcollateralization` vs `Over-collateralization`
  Impact:
  - Search quality, dedupe logic, and SRS term identity will degrade over time.

- Medium: Term-page SEO is English-first, not Russian-first.
  Evidence: `app/term/[id]/page.tsx:24-37`, `:88-94`
  Problem:
  - Title and description lead with English.
  - Back-navigation copy is English only.
  Impact:
  - The most important public SEO surface contradicts the Russian-first strategy.

- Medium: Profile and favorites features depend on schema that is not coherently represented in migrations.
  Evidence:
  - `profiles` is present in generated types: `types/supabase.ts:12-31`
  - But not in checked-in schema/migrations reviewed during this audit.
  - Bot still expects a `favorites` table while web does not.
  Impact:
  - Core business flows are relying on undeclared infrastructure.

### Recommendations

- Define a formal Russian-first contract:
  - first-render locale
  - metadata locale
  - manifest locale
  - default DB locale
  - auth-flow locale
- Expand the term model to include at least:
  - `aliases`
  - `abbreviations`
  - `jurisdictions`
  - `markets`
  - `discipline_tags`
  - `related_term_ids`
  - `source_reference`
  - `regulatory_context`
  - `difficulty_level`
- Add explicit cross-border market coverage for:
  - MOEX
  - BIST
  - clearing/settlement venue terms
  - sanctions/payment-routing terminology
  - exchange, depository, and custody vocabulary
- Build a corpus QA pipeline:
  - normalized duplicate detection
  - missing-translation detection
  - category drift detection
  - jurisdiction/market completeness checks
- Unify favorites and profile schemas so the bot, web app, and analytics all use the same model.

## Remediation Order

1. Lock down Supabase trust boundaries.
   Remove client-writable badge/log policies and fix `study_sessions` RLS immediately.

2. Freeze legacy SQL.
   Archive or clearly deprecate old bot migrations so they cannot be re-applied accidentally.

3. Unify the data model.
   Pick one favorites model and one learning-log model, then migrate bot and web together.

4. Fix streak semantics.
   Streaks must derive from immutable study events, never page loads.

5. Add submission locks.
   Prevent duplicate writes in quiz/favorite/link flows.

6. Enforce Russian-first defaults everywhere.
   Metadata, manifest, DB defaults, guest defaults, and auth UI must agree.

7. Upgrade the terminology schema.
   The current flat glossary structure is not enough for the project’s claimed market and academic scope.

## Bottom Line

FinTechTerms has promising building blocks, but the current monorepo is still in a transition state rather than a production-grade, security-consistent architecture. The latest Supabase hardening work is directionally correct, yet it is being undercut by legacy SQL, split schemas, and business logic that still trusts client-writable state.

Until the data model is unified and the write boundaries are tightened, the platform cannot honestly claim:
- hardened account linking
- trustworthy gamification analytics
- seamless bot/web synchronization
- strict Russian-first localization
- postgraduate-ready cross-border finance terminology support
