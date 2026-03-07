# FinTechTerms Pre-Flight QC Report

Date: 2026-03-06
Audit Mode: Phased pre-flight QC after Telegram auth decoupling
Verdict: Not ready for VK OAuth yet
Overall Readiness: 63/100

## Executive Verdict

The project is close to a contest-ready product shell, but it is not yet a safe base for another auth provider.

The main blockers are:

- Telegram decoupling is incomplete in repo history, type definitions, and dead frontend utilities.
- Several user-facing flows still confuse failure with empty state, which is dangerous for a study product.
- Russian is the shell default, but not an unbreakable runtime default.
- Contest taxonomy is well modeled in Supabase and seed data, but the web app barely exposes it.

## 1. Codebase Cleanliness & Dead Code

Score: 61/100

### Why This Score

The app-level Telegram route and link card are already removed, which is good. The remaining problem is that the repo still carries a noticeable amount of orphaned code, Telegram-linked migration history, stale type fields, and tracked clutter. For a stabilization branch before another OAuth provider, this is too much ambiguity.

### Delete Immediately

- `components/HomeHeader.tsx` (whole file, orphaned)
- `components/DynamicHtmlLang.tsx` (whole file, orphaned)
- `components/features/index.ts` (whole file, unused barrel)
- `lib/apiVersion.ts` (whole file, unused)
- `lib/pushNotification.ts` (whole file, unused duplicate logic)
- `app/api/telegram/.DS_Store` (filesystem artifact)
- `telegram-bot/migrations/001_bot_user_stats.sql` (legacy bot-only schema)
- `telegram-bot/migrations/003_telegram_web_sync.sql` (legacy Telegram web-link flow)
- `telegram-bot/migrations/004_fix_telegram_link_rpc.sql` (legacy Telegram patch)
- `afk_execution_summary.md` (stale internal report)
- `dev_notes.md` (stale internal notes)
- `FINTECHTERMS_ELITE_AUDIT_REPORT.md` (stale audit artifact)
- `Gemini_Generated_Image_juao3juao3juao3j.png` (tracked, unreferenced)
- `ChatGPT Image 14 Oca 2026 21_23_57.png` (tracked, unreferenced)

### Dead Symbols To Remove

- `lib/rate-limiter.ts:90` `telegramLinkRateLimiter`
- `lib/rate-limiter.ts:93` `globalRateLimiter`
- `lib/validators.ts:53` `PartialTermSchema`
- `lib/validators.ts:56` `UserSchema`
- `lib/supabaseUtils.ts:26` `handleSupabaseQuery`
- `lib/supabaseUtils.ts:59` `API_ERRORS`
- `types/supabase.ts:17`, `types/supabase.ts:23`, `types/supabase.ts:29` stale `profiles.telegram_id`

### Database / Migration Debt Still Relevant

- `supabase/migrations/20260306190000_phase5_decouple_telegram_and_favorites.sql` correctly drops Telegram link tables and functions, but it does not drop `public.merge_shadow_user_state(uuid, uuid)`.
- `supabase/migrations/20260306143000_security_hardening.sql` and `supabase/migrations/20260306170000_phase1_database_unification_lockdown.sql` still carry historical Telegram link logic. That is acceptable only as migration history, not as an architectural source of truth.

### Objects That Still Need To Be Dropped From Live Schema

- `public.merge_shadow_user_state(uuid, uuid)`

## 2. Edge Case Handling & Resilience

Score: 57/100

### Why This Score

The app usually avoids catastrophic crashes, but it still has several high-value integrity failures. The biggest issue is that some failures are silently converted into harmless-looking empty screens. In a contest app, misleading correctness is worse than a clean error state.

### Findings

- High: quiz double-submission race
  - `app/quiz/QuizClient.tsx:68`
  - `contexts/SRSContext.tsx:363`
  - `contexts/SRSContext.tsx:373`
  - Fast repeated answers can produce distinct backend writes because each call creates a new idempotency key.

- High: Supabase partial outage can impersonate valid empty progress
  - `lib/supabaseStorage.ts:130`
  - `lib/supabaseStorage.ts:162`
  - `contexts/SRSContext.tsx:193`
  - `contexts/SRSContext.tsx:217`
  - `app/favorites/FavoritesClient.tsx:12`
  - `app/favorites/FavoritesClient.tsx:50`
  - Returning users can be shown “no favorites” when cloud reads fail.

- Medium: search does not distinguish initial state vs failure vs no results
  - `app/search/SearchClient.tsx:14`
  - `app/search/SearchClient.tsx:15`
  - `app/search/SearchClient.tsx:77`
  - `app/search/SearchClient.tsx:88`

- Medium: registration and login use only a soft UI lock
  - `hooks/useAuthLogic.ts:139`
  - `hooks/useAuthLogic.ts:175`
  - `components/features/auth/AuthForm.tsx:160`

- Medium: quick quiz count selector can promise more cards than filtered pool contains
  - `app/quiz/QuizClient.tsx:49`
  - `app/quiz/QuizClient.tsx:58`
  - `app/quiz/QuizClient.tsx:236`

- Low: zero-streak state is localized, but still weak as first-time onboarding
  - `components/profile/StreakCard.tsx:107`
  - `components/profile/StreakCard.tsx:138`
  - `components/profile/Heatmap.tsx:225`

## 3. Contest Alignment & Localization

Score: 71/100

### Why This Score

The project clearly aims at a Russian-first academic product, and the schema work for contest taxonomy is better than the current UI. The score is dragged down because the runtime still allows non-Russian defaults, Turkish leaks remain in global routes, and the contest taxonomy is mostly invisible on the web surface.

### Russian-First Strengths

- `app/layout.tsx:31` and `app/layout.tsx:125` keep SSR `<html lang="ru">`.
- `public/manifest.json:2`, `public/manifest.json:4`, and `public/manifest.json:65` are Russian-first.
- `public/offline.html:2` and `public/offline.html:6` are Russian-first.
- `locales/ru.json` is complete and has no empty keys.

### Russian-First Failures

- High: URL localization is advertised but not actually wired
  - `app/layout.tsx:67`
  - `app/layout.tsx:72`
  - `app/layout.tsx:73`
  - Runtime language is not driven by the URL; it comes from localStorage/env in `contexts/LanguageContext.tsx`.

- High: runtime default can still become English or Turkish
  - `contexts/LanguageContext.tsx:15`
  - `contexts/LanguageContext.tsx:16`
  - `contexts/LanguageContext.tsx:19`
  - `contexts/LanguageContext.tsx:139`

- Medium: 404 route is hardcoded Turkish
  - `app/not-found.tsx:14`
  - `app/not-found.tsx:17`
  - `app/not-found.tsx:25`
  - `app/not-found.tsx:32`

- Medium: about page title map points at the wrong route
  - `contexts/LanguageContext.tsx:62`
  - Live page is `/about` in `app/about/page.tsx:8`

- Medium: primary fonts preload only `latin`
  - `app/layout.tsx:16`
  - `app/layout.tsx:17`
  - `app/layout.tsx:22`
  - `app/layout.tsx:23`

- Low: English leakage in accessibility and structured data
  - `components/SearchBar.tsx:56`
  - `components/SearchBar.tsx:77`
  - `components/SearchBar.tsx:89`
  - `components/SmartCard.tsx:231`
  - `app/about/AboutClient.tsx:150`

### Contest / Academic Model Strengths

- `types/index.ts:49` and `types/index.ts:51` define `context_tags` and `regional_market`.
- `supabase/migrations/20260306183000_phase4_schema_upgrade_for_contest_readiness.sql:16` adds both taxonomy fields.
- `supabase/migrations/20260306183000_phase4_schema_upgrade_for_contest_readiness.sql:89` creates `academic_decks`.
- `data/terms/utils.ts:4` seeds contest-focused default taxonomy.
- `telegram-bot/bot/database.py:22` and `telegram-bot/bot/database.py:124` actively use academic filters for MOEX, BIST, SPbU, and HSE.

### Contest / Academic Product Gaps

- The Next.js web app exposes contest taxonomy mostly in metadata only:
  - `app/term/[id]/page.tsx:14`
  - `app/term/[id]/page.tsx:52`
  - `app/term/[id]/page.tsx:149`

- Search remains category/text-only and does not allow academic or market filtering:
  - `components/SearchBar.tsx:23`
  - `components/SearchBar.tsx:29`
  - `components/SearchBar.tsx:35`
  - `components/SearchBar.tsx:97`

- No frontend consumer was found for `academic_decks` or `academic_deck_terms` in `app/`, `components/`, `contexts/`, or `hooks/`.

## Clear Path Forward

### 1. Exact Cleanup Commands And Required Deletions

Safe immediate repo cleanup:

```bash
git rm components/HomeHeader.tsx components/DynamicHtmlLang.tsx components/features/index.ts lib/apiVersion.ts lib/pushNotification.ts telegram-bot/migrations/001_bot_user_stats.sql telegram-bot/migrations/003_telegram_web_sync.sql telegram-bot/migrations/004_fix_telegram_link_rpc.sql afk_execution_summary.md dev_notes.md FINTECHTERMS_ELITE_AUDIT_REPORT.md "Gemini_Generated_Image_juao3juao3juao3j.png" "ChatGPT Image 14 Oca 2026 21_23_57.png"
rm -f app/api/telegram/.DS_Store
```

Forward-only live database cleanup:

```bash
npx supabase migration new 20260307_phase6_vk_preflight_cleanup
```

SQL that should go into that migration:

```sql
drop function if exists public.merge_shadow_user_state(uuid, uuid);
```

Historical migration baseline cleanup:

- Do not delete already-applied Supabase migrations midstream in a live environment.
- If the project is still pre-production and you want a cleaner baseline before launch, re-squash Telegram auth logic out of:
  - `supabase/migrations/20260306143000_security_hardening.sql`
  - `supabase/migrations/20260306170000_phase1_database_unification_lockdown.sql`

Manual code fixes required before release:

- Submission locking and idempotency
  - `app/quiz/QuizClient.tsx`
  - `contexts/SRSContext.tsx`
  - `hooks/useAuthLogic.ts`
  - `components/features/auth/AuthForm.tsx`

- Honest failure vs empty-state separation
  - `lib/supabaseStorage.ts`
  - `contexts/SRSContext.tsx`
  - `app/favorites/FavoritesClient.tsx`
  - `app/search/SearchClient.tsx`

- Russian-first runtime enforcement
  - `app/layout.tsx`
  - `contexts/LanguageContext.tsx`
  - `app/not-found.tsx`
  - `components/SearchBar.tsx`
  - `components/SmartCard.tsx`
  - `app/about/AboutClient.tsx`

- Contest taxonomy exposure in the web UI
  - `components/SearchBar.tsx`
  - `app/search/SearchClient.tsx`
  - `components/SmartCard.tsx`
  - `app/term/[id]/page.tsx`

Verification commands after fixes:

```bash
npm run lint
npm test
npm run build
```

### 2. Architectural Prerequisite Checklist Before VK OAuth

- [ ] Remove all remaining Telegram-auth-specific code paths, stale type fields, and merge helpers that could contaminate a new provider flow.
- [ ] Decide on a provider-neutral identity model before adding VK.
  - Minimum shape: `user_id`, `provider`, `provider_user_id`, `provider_username`, `profile_data`, `linked_at`, unique constraints on `(provider, provider_user_id)`.
- [ ] Replace Telegram-era shadow-account merge assumptions with a provider-agnostic account-link policy.
  - Either ban shadow users entirely or define a single audited merge path for OAuth identity collisions.
- [ ] Enforce strict client and server idempotency for auth and quiz writes.
- [ ] Separate loading, empty, degraded, and hard-error states on favorites, search, profile, and quiz surfaces.
- [ ] Make Russian the deterministic default across SSR, hydration, URL handling, metadata, aria labels, and offline screens.
- [ ] Either implement real URL-driven localization or remove `/?lang=tr` and `/?lang=en` alternates from metadata.
- [ ] Expose contest taxonomy on the web surface.
  - Minimum acceptable baseline: visible `regional_market`, visible academic context tags, and at least one user-facing entry point for `academic_decks`.
- [ ] Add tests for:
  - OAuth callback success
  - OAuth callback denial/cancellation
  - duplicate submit prevention
  - provider collision / already-linked identity
  - Supabase degraded mode
  - Russian fallback behavior
- [ ] Add observability for auth callback failures and account-link conflicts before rollout.
- [ ] Require a clean pass on `npm run lint`, `npm test`, and `npm run build` on a Telegram-free branch before merging VK work.

## Final Readiness Statement

FinTechTerms is close to a strong contest demo, but it is still in stabilization, not in extension mode. The right move is to finish cleanup, harden submission and failure behavior, and make Russian/default-localization rules deterministic before a VK OAuth branch is allowed to start.
