-- ============================================
-- Migration 004: Fix Telegram Link RPC (v2 - Admin Client Compatible)
-- Resolves RLS blocking on account_link_tokens table
-- Run this in Supabase SQL Editor
-- ============================================

-- The original link_telegram_account relied on auth.uid() which requires
-- the caller to be an authenticated user session. However, the
-- account_link_tokens table has RLS enabled with NO read policies for
-- authenticated users, causing the token lookup to fail silently.
--
-- This v2 function accepts the web user ID explicitly, allowing the
-- API route to call it via the Service Role client (which bypasses RLS).
-- The API route still authenticates the user first before passing their ID.

CREATE OR REPLACE FUNCTION public.link_telegram_account_v2(
    p_token TEXT,
    p_web_user_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_telegram_id BIGINT;
    v_shadow_user_id UUID;
BEGIN
    -- 1. Validate user ID
    IF p_web_user_id IS NULL THEN
        RAISE EXCEPTION 'Oturum açmadınız. İşlem reddedildi.';
    END IF;

    -- 2. Token validation
    SELECT telegram_id INTO v_telegram_id
    FROM public.account_link_tokens
    WHERE token = p_token AND expires_at > NOW();

    IF v_telegram_id IS NULL THEN
        RAISE EXCEPTION 'Geçersiz veya süresi dolmuş token.';
    END IF;

    -- Delete verified token (replay attack protection)
    DELETE FROM public.account_link_tokens WHERE token = p_token;

    -- 3. Check if shadow account exists
    SELECT user_id INTO v_shadow_user_id
    FROM public.telegram_users
    WHERE telegram_id = v_telegram_id;

    IF v_shadow_user_id IS NOT NULL THEN
        IF v_shadow_user_id = p_web_user_id THEN
            RETURN jsonb_build_object('success', true, 'message', 'Bu Telegram hesabı zaten profilinize bağlı.', 'telegram_id', v_telegram_id);
        END IF;

        -- DATA MIGRATION & MERGE (Shadow account -> Real account)

        -- 3.1 Quiz Attempts:
        UPDATE public.quiz_attempts SET user_id = p_web_user_id WHERE user_id = v_shadow_user_id;

        -- 3.2 SRS Data:
        UPDATE public.user_term_srs 
        SET user_id = p_web_user_id 
        WHERE user_id = v_shadow_user_id 
        AND term_id NOT IN (SELECT term_id FROM public.user_term_srs WHERE user_id = p_web_user_id);

        -- 3.3 Daily Learning Log Merge:
        INSERT INTO public.daily_learning_log (
            user_id, log_date, words_reviewed, words_correct, words_incorrect, new_words_learned
        )
        SELECT 
            p_web_user_id, log_date, words_reviewed, words_correct, words_incorrect, new_words_learned
        FROM public.daily_learning_log
        WHERE user_id = v_shadow_user_id
        ON CONFLICT (user_id, log_date)
        DO UPDATE SET
            words_reviewed = public.daily_learning_log.words_reviewed + EXCLUDED.words_reviewed,
            words_correct = public.daily_learning_log.words_correct + EXCLUDED.words_correct,
            words_incorrect = public.daily_learning_log.words_incorrect + EXCLUDED.words_incorrect,
            new_words_learned = public.daily_learning_log.new_words_learned + EXCLUDED.new_words_learned;

        -- 3.4 Point telegram mapping to real web user
        UPDATE public.telegram_users SET user_id = p_web_user_id WHERE telegram_id = v_telegram_id;

        -- 3.5 Cleanup orphaned shadow user
        DELETE FROM auth.users WHERE id = v_shadow_user_id;
    ELSE
        -- No bot stats exist yet, direct link
        INSERT INTO public.telegram_users (telegram_id, user_id)
        VALUES (v_telegram_id, p_web_user_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Hesap başarıyla birleştirildi!', 'telegram_id', v_telegram_id);
END;
$$;
