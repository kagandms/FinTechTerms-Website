# Database Tables Reference (M23, M24, M26)

## Active Tables

### `terms`
- **Used by:** Web (SRSContext) + Bot (handlers)
- **RLS:** Read-only for all users
- Columns: id, term_en, term_tr, term_ru, category, definition_*, example_sentence_*

### `user_progress`
- **Used by:** Web (SRSContext sync for authenticated users)
- **RLS:** auth.uid() = user_id
- Columns: user_id, favorites, current_streak, quiz_history, last_study_date

### `user_term_srs`
- **Used by:** Web (SRSContext cloud sync)
- **RLS:** auth.uid() = user_id
- Columns: user_id, term_id, srs_level, next_review_date, difficulty_score, retention_rate

### `bot_activity`
- **Used by:** Telegram Bot (activity tracking)
- **RLS:** Insert-only for service role
- Columns: user_id, action, timestamp, metadata

---

## Unused Tables (Integration Needed)

### `user_achievements` 🔲
- **Status:** Schema exists but not integrated in frontend
- **Integration Plan:**
  - Create AchievementsPanel component in /components/features/profile/
  - Display badges for milestones: 10 terms mastered, 7-day streak, first quiz, etc.
  - Hook into SRSContext submitQuizAnswer to trigger achievement checks
  - Bot: Add /achievements command

### `daily_learning_log` 🔲
- **Status:** Schema exists but not used
- **Integration Plan:**
  - Log each study session automatically in SRSContext
  - Display in Analytics page as a heatmap (GitHub-style contribution graph)
  - Bot: Include in /report command

---

## Migration Strategy (M26)

### Current Approach
- Supabase Dashboard → SQL Editor for schema changes
- No version-controlled migrations

### Recommended Approach
1. Create `/supabase/migrations/` directory
2. Use `supabase migration new <name>` CLI
3. Store migration SQL files in version control
4. Apply via `supabase db push` in CI/CD

### Example Migration
```sql
-- supabase/migrations/20260227_add_achievements.sql
ALTER TABLE user_achievements
  ADD COLUMN IF NOT EXISTS badge_icon TEXT DEFAULT '🏆',
  ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ DEFAULT NOW();
```
