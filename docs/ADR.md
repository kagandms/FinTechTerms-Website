# Architecture Decision Records (ADR)

## ADR-001: Next.js App Router with ISR
- **Date:** 2025-12
- **Status:** Accepted
- **Decision:** App Router (not Pages Router) with `revalidate = 3600`
- **Why:** Server Components reduce client-side JS. ISR gives SEO without cold starts.
- **Trade-off:** App Router is newer = fewer community examples; ISR adds Vercel dependency.

## ADR-002: Supabase as Backend-as-a-Service
- **Date:** 2025-12
- **Status:** Accepted
- **Decision:** Supabase (PostgreSQL + Auth + RLS) over Firebase/custom backend
- **Why:** Free tier generous; RLS provides row-level security without server code; built-in Auth with OTP.
- **Trade-off:** Vendor lock-in risk; need `anon` key in client (mitigated by RLS).

## ADR-003: Client-Side SRS Algorithm
- **Date:** 2025-12
- **Status:** Accepted
- **Decision:** SRS runs in browser (localStorage + optional Supabase sync) not server-side
- **Why:** Instant feedback; works offline (PWA); reduces server load.
- **Trade-off:** Data can be lost if localStorage cleared; requires sync logic for auth users.

## ADR-004: Monorepo for Web + Telegram Bot
- **Date:** 2026-01
- **Status:** Accepted
- **Decision:** Single repo houses Next.js web app and Python Telegram bot
- **Why:** Shared DB (Supabase); simpler CI/CD; one source of truth for terms.
- **Trade-off:** Mixed languages (TS + Python); need separate Dockerfiles.

## ADR-005: Tailwind CSS over Component Library
- **Date:** 2025-12
- **Status:** Accepted
- **Decision:** Tailwind + custom CSS variables over Material UI / Chakra
- **Why:** Full design control; smaller bundle; dark mode with class strategy.
- **Trade-off:** More CSS to write; less out-of-the-box components.

## ADR-006: In-Memory Rate Limiter (with Redis upgrade path)
- **Date:** 2026-01
- **Status:** Accepted (with caveat)
- **Decision:** `RateLimiter` class uses in-memory Map for rate limiting
- **Why:** Zero-dependency, works for low traffic, no external service needed.
- **Caveat:** Per-instance in serverless (Vercel). Upgrade to `@upstash/ratelimit` when needed.

## ADR-007: OTP Email Auth over Magic Link
- **Date:** 2026-01
- **Status:** Accepted
- **Decision:** Supabase OTP (numeric code) over magic link for email auth
- **Why:** Better mobile UX (no link switching); less email deliverability issues.
- **Trade-off:** Users must memorize code; 60-second expiry window.

## ADR-008: Trilingual i18n (EN/TR/RU) without Framework
- **Date:** 2025-12
- **Status:** Accepted
- **Decision:** Custom JSON locale files + LanguageContext rather than next-intl/i18next
- **Why:** Simpler setup; only 3 languages; no URL-based locale routing needed.
- **Trade-off:** No pluralization rules; no automatic locale detection from browser.
