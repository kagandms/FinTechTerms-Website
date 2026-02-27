# Security & Threat Model

## Supabase Anon Key Exposure (M46)
The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally exposed in client-side code.
This is safe because:
- All tables have Row Level Security (RLS) policies
- Users can only read/write their own data (`auth.uid() = user_id`)
- The `terms` table is read-only for all users
- The key cannot bypass RLS (only the `service_role` key can)

**Risk:** LOW — Standard Supabase architecture pattern.

## localStorage Data Security (M47)
The following data is stored in `localStorage`:
- `globalfinterm_terms`: Term data (public, non-sensitive)
- `globalfinterm_user_progress`: Favorites, quiz history, streak (personal but non-critical)
- `globalfinterm_language`: Language preference (non-sensitive)

**Risk:** LOW — No passwords, tokens, or financial data stored.
XSS would be the only vector, mitigated by CSP headers.

## API Error Response Standard (M43)
All API routes should return errors in this format:
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Try again in 60 seconds.",
    "status": 429
  }
}
```

## Deployment Strategy — Telegram Bot (M56)
Options:
1. **Render (free tier):** Webhook mode + Flask health check + UptimeRobot ping
2. **Docker (VPS):** Use `telegram-bot/Dockerfile` on any VPS provider
3. **Railway:** Push to deploy with `Procfile`

Recommended: Render for free, Docker for reliability.
