# FinTechTerms — Trilingual Financial Dictionary

> 📖 **EN** · **TR** · **RU** — Learn finance, fintech & IT terms with SRS-powered spaced repetition.

[![CI/CD](https://github.com/YOUR_USERNAME/fintechterms/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/fintechterms/actions)
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

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

### Telegram Bot (Python)

```bash
cd telegram-bot

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your BOT_TOKEN and SUPABASE_KEY

# Run the bot
python -m bot
```

## 🧪 Testing

```bash
# Unit tests (Jest)
npx jest --verbose

# E2E tests (Playwright)
npx playwright test

# Bot tests (pytest)
cd telegram-bot && python -m pytest tests/ -v
```

## 📚 Documentation

- **[ADR.md](docs/ADR.md)** — Architecture Decision Records
- **[SECURITY.md](docs/SECURITY.md)** — Threat model & security documentation

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 18, TypeScript |
| Styling | Tailwind CSS, CSS Variables, Dark Mode |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Bot | python-telegram-bot, gTTS |
| Testing | Jest, Playwright, pytest |
| CI/CD | GitHub Actions, Vercel |
| PWA | Workbox, Service Worker |

## 📄 License

MIT
