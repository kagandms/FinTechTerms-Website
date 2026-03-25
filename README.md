# FinTechTerms — Trilingual Financial Dictionary

> 📖 **EN** · **TR** · **RU** — Learn finance, fintech & IT terms with SRS-powered spaced repetition.

[![CI/CD](https://github.com/kagandms/FinTechTerms-Website/actions/workflows/ci.yml/badge.svg)](https://github.com/kagandms/FinTechTerms-Website/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/demo-fintechterms.vercel.app-blue)](https://fintechterms.vercel.app)

---

## 🏗 Architecture

This is a **monorepo** containing two applications sharing a single Supabase database:

```
FinTechTerms Website/
├── app/                  # Next.js 16 App Router (web app)
├── components/           # React components (SmartCard, DailyReview, etc.)
├── contexts/             # React Context (Auth, SRS, Language, Theme, Toast)
├── lib/                  # Supabase client, validators, rate-limiter
├── utils/                # SRS algorithm, storage, helpers
├── data/                 # Static term data + mock data
├── locales/              # i18n translations (en.json, tr.json, ru.json)
├── __tests__/            # Jest unit tests
├── e2e/                  # Playwright E2E tests
├── docs/                 # ADR, SECURITY documentation
├── public/               # Static assets, PWA manifest, service worker
├── telegram-bot/         # Python Telegram Bot (separate deployment)
│   ├── bot/              # Bot modules (handlers, database, i18n, tts)
│   ├── tests/            # pytest test suite
│   ├── Dockerfile        # Container deployment
│   └── requirements.txt  # Python dependencies
└── .github/workflows/    # CI/CD pipeline
```

## 🚀 Quick Start

### Web App (Next.js)

```bash
# Install dependencies
npm install

# Set environment variables for the web app and repo-level scripts
cp .env.example .env.local
# Edit .env.local with the web app values from the "Web App / Shared Scripts" section

# Run development server
npm run dev
```

> After cloning, run `npm run dev` once before opening the project in your IDE.
> Next.js generates `next-env.d.ts` on first run, and TypeScript tooling expects that file locally.

> ⚠ **Database setup**: The canonical schema lives in `supabase/migrations/`, starting with `20260306000000_canonical_baseline.sql`.
> Always apply schema changes with the migration chain (`supabase db push` for remote targets or `npm run verify:bootstrap-db` for a clean bootstrap smoke check).
> Never manually execute SQL files from `lib/`. Those files are archived references only.

Repo-level maintenance scripts such as `scripts/run_schema_update.py` read
`.env.local` first and fall back to `.env`, so a developer who follows the
setup above can run both the app and the scripts without duplicating values.

> ⚠ The Telegram bot uses `SUPABASE_ANON_KEY` (public anon key, RLS enforced).
> Root maintenance scripts use `SUPABASE_SERVICE_ROLE_KEY` (privileged and not safe to share).
> These keys are different and must never be substituted for one another.

### Telegram Bot (Python)

```bash
cd telegram-bot

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables for the bot runtime
cp .env.example .env
# Edit .env with the bot values from the "Telegram Bot Runtime" section

# Run the bot
python -m bot
```

The root [`.env.example`](.env.example) is the complete catalog of every
environment variable consumed anywhere in the repo. Use root `.env.local` for
the web app and repo-level scripts, and `telegram-bot/.env` for the bot.

## 🧪 Testing

```bash
# Unit tests (Jest)
npx jest --verbose

# Type-check
npm run typecheck

# Runtime env validation (build/start prerequisites)
npm run validate:runtime-env

# Verify that executable release surfaces never reference archived SQL sources
npm run verify:sql-sources

# Preview/staging release-gate env validation
npm run validate:release-gate-env

# Clean bootstrap DB smoke (requires psql and BOOTSTRAP_DB_URL or DATABASE_URL)
npm run verify:bootstrap-db

# E2E tests (Playwright)
npx playwright test
npm run test:e2e:guest
npm run test:e2e:auth

# Bot tests (pytest)
cd telegram-bot && python -m pytest tests/ -v
```

The authenticated Playwright flow uses `E2E_AUTH_EMAIL` and `E2E_AUTH_PASSWORD`.
Set them in local `.env.local` for `npx playwright test`, and in GitHub Actions
as repository secrets for `.github/workflows/e2e.yml`.

Preview release verification uses:
- `npm run validate:runtime-env`
- `npm run validate:release-gate-env`
- `npm run verify:bootstrap-db`
- `npm run verify:release-db`
- `npm run test:e2e:guest`
- `npm run test:e2e:auth`
- `npm run smoke:staging`

If Preview Deployment Protection is enabled on Vercel, also provide
`VERCEL_AUTOMATION_BYPASS_SECRET` so Playwright and staging smoke can access
the protected preview URL non-interactively.

Production observability is wired through Sentry. Set
`NEXT_PUBLIC_SENTRY_DSN` to enable browser/server error capture and add
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` in CI only if you want
source-map upload. Staging and production release verification now assume
`NEXT_PUBLIC_SENTRY_DSN` is present.

Study-session analytics require `STUDY_SESSION_TOKEN_SECRET` at runtime. This
must be a high-entropy server secret and must never reuse the Supabase service
role key.

Production-safe API throttling requires Upstash Redis. Staging and production
must provide `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; the
in-memory limiter is intended only for development and test environments.

`npm run verify:release-db` now validates both database release readiness and
the mirror integrity between the repo term corpus and `public.terms`.

## 📚 Documentation

- **[ADR.md](docs/ADR.md)** — Architecture Decision Records
- **[DATABASE.md](docs/DATABASE.md)** — Canonical schema, runtime tables, and migration workflow
- **[SECURITY.md](docs/SECURITY.md)** — Threat model & security documentation
- **[OPERATIONS.md](docs/OPERATIONS.md)** — Deploy, rollback, and incident runbook
- **[PRODUCTION_READINESS_DOSSIER_2026-03-19.md](docs/PRODUCTION_READINESS_DOSSIER_2026-03-19.md)** — Current production-readiness status, blockers, and sign-off matrix

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 18, TypeScript |
| Styling | Tailwind CSS, CSS Variables, Dark Mode |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Bot | python-telegram-bot, edge-tts |
| Testing | Jest, Playwright, pytest |
| CI/CD | GitHub Actions, Vercel |
| PWA | Workbox, Service Worker |

## 📄 License

MIT
