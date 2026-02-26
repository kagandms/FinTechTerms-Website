# FinTechTerms Telegram Bot

Telegram bot integrated with [FinTechTerms](https://fintechterms.vercel.app) — a trilingual (EN/TR/RU) finance & technology dictionary PWA.

## Features

- 📖 **Daily Term** — Automated trilingual term of the day
- 🎯 **Inline Quiz** — SRS-based flashcard quiz with callback buttons
- 🔍 **Term Search** — Search 1250+ terms in 3 languages
- 🗣️ **Voice Pronunciation** — TTS audio for terms in EN/TR/RU
- 📊 **Progress Stats** — Track your learning progress
- 🌍 **Language Switch** — Switch interface language on the fly
- 🔗 **Web Sync** — Same Supabase DB as the web app

## Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Fill in your BOT_TOKEN and Supabase credentials

# Run the bot
python -m bot.main
```

## Environment Variables

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Telegram Bot API token from @BotFather |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |
| `ADMIN_USER_ID` | Your Telegram user ID for admin commands |

## Tech Stack

- Python 3.12+
- python-telegram-bot v21+
- supabase-py
- edge-tts (text-to-speech)
