-- ============================================
-- Migration 003: Single Source of Truth & Account Linking
-- Links Telegram Users to Supabase Auth & Resolves Dual-Identity Edge Case
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create table to map Telegram ID to Supabase Auth UUID
CREATE TABLE IF NOT EXISTS public.telegram_users (
    telegram_id BIGINT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_username TEXT,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT telegram_users_user_id_key UNIQUE(user_id)
);

ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

-- Allow the Service Role Bot to manage mappings
CREATE POLICY "Service Role can manage telegram_users" 
    ON public.telegram_users 
    USING (true) 
    WITH CHECK (true);

-- 2. OTP Token Tablosu (Geçici Hesap Birleştirme Kodları)
CREATE TABLE IF NOT EXISTS public.account_link_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.account_link_tokens ENABLE ROW LEVEL SECURITY;

-- 3. Bot için OTP Kod Üretme Fonksiyonu
CREATE OR REPLACE FUNCTION public.generate_telegram_link_token(
    p_telegram_id BIGINT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token TEXT;
BEGIN
    IF p_telegram_id IS NULL OR p_telegram_id <= 0 THEN
        RAISE EXCEPTION 'Geçersiz Telegram ID';
    END IF;

    -- Süresi geçmiş ve bu telegram_id'ye ait eski tokenları (Çöp) temizle
    DELETE FROM public.account_link_tokens 
    WHERE telegram_id = p_telegram_id OR expires_at < NOW();
    
    -- Rastgele 6 haneli nümerik kod oluştur (Örn: 049583)
    v_token := lpad(floor(random() * 1000000)::text, 6, '0');
    
    -- Eşsizliğinden emin ol
    WHILE EXISTS (SELECT 1 FROM public.account_link_tokens WHERE token = v_token) LOOP
        v_token := lpad(floor(random() * 1000000)::text, 6, '0');
    END LOOP;

    INSERT INTO public.account_link_tokens (telegram_id, token) VALUES (p_telegram_id, v_token);
    
    RETURN v_token;
END;
$$;


-- 4. Hesap Birleştirme ve Veri Aktarımı (Web Client Tarafından Çağrılır)
CREATE OR REPLACE FUNCTION public.link_telegram_account(
    p_token TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_web_user_id UUID := auth.uid();
    v_telegram_id BIGINT;
    v_shadow_user_id UUID;
BEGIN
    -- 1. Web'de oturum açık mı kontrolü
    IF v_web_user_id IS NULL THEN
        RAISE EXCEPTION 'Oturum açmadınız. İşlem reddedildi.';
    END IF;

    -- 2. Token dogrulama
    SELECT telegram_id INTO v_telegram_id
    FROM public.account_link_tokens
    WHERE token = p_token AND expires_at > NOW();

    IF v_telegram_id IS NULL THEN
        RAISE EXCEPTION 'Geçersiz veya süresi dolmuş token.';
    END IF;

    -- Doğrulanan tokeni sil (Replay attack koruması)
    DELETE FROM public.account_link_tokens WHERE token = p_token;

    -- 3. Gölge Hesap Var Mı Dünyası
    SELECT user_id INTO v_shadow_user_id
    FROM public.telegram_users
    WHERE telegram_id = v_telegram_id;

    IF v_shadow_user_id IS NOT NULL THEN
        IF v_shadow_user_id = v_web_user_id THEN
            RETURN jsonb_build_object('success', true, 'message', 'Bu Telegram hesabı zaten profilinize bağlı.');
        END IF;

        -- 🔥 VERİ TAŞIMA VE MERGE (Gölge hesaptan -> Asıl hesaba)

        -- 3.1 Quiz Attempts:
        UPDATE public.quiz_attempts SET user_id = v_web_user_id WHERE user_id = v_shadow_user_id;

        -- 3.2 Spaced Repetition System (SRS) Verileri:
        -- Çakışanları yoksay, sadece web'de okumadığı terimleri aktar
        UPDATE public.user_term_srs 
        SET user_id = v_web_user_id 
        WHERE user_id = v_shadow_user_id 
        AND term_id NOT IN (SELECT term_id FROM public.user_term_srs WHERE user_id = v_web_user_id);

        -- 3.3 Günlük İstatistikleri Kayıpsız Birleştirme:
        INSERT INTO public.daily_learning_log (
            user_id, log_date, words_reviewed, words_correct, words_incorrect, new_words_learned
        )
        SELECT 
            v_web_user_id, log_date, words_reviewed, words_correct, words_incorrect, new_words_learned
        FROM public.daily_learning_log
        WHERE user_id = v_shadow_user_id
        ON CONFLICT (user_id, log_date)
        DO UPDATE SET
            words_reviewed = public.daily_learning_log.words_reviewed + EXCLUDED.words_reviewed,
            words_correct = public.daily_learning_log.words_correct + EXCLUDED.words_correct,
            words_incorrect = public.daily_learning_log.words_incorrect + EXCLUDED.words_incorrect,
            new_words_learned = public.daily_learning_log.new_words_learned + EXCLUDED.new_words_learned;

        -- 3.4 Artık bot asıl Web profiline işaret etmeli
        UPDATE public.telegram_users SET user_id = v_web_user_id WHERE telegram_id = v_telegram_id;

        -- 3.5 Yetim (Orphaned) Gölge Kullanıcısının temizlenmesi (auth.users)
        DELETE FROM auth.users WHERE id = v_shadow_user_id;
    ELSE
        -- Hiç bot istatistiği oluşmamış, direkt bağla
        INSERT INTO public.telegram_users (telegram_id, user_id)
        VALUES (v_telegram_id, v_web_user_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Hesap başarıyla birleştirildi!', 'telegram_id', v_telegram_id);
END;
$$;


-- 5. Eski "Gölge Kullanıcı" Mekanizması
-- Sadece bot tarafında "henüz hesabını bağlamamış" sıfır kullanıcılar için çalışmaya devam eder.
CREATE OR REPLACE FUNCTION public.sync_telegram_user(
    p_telegram_id BIGINT,
    p_username TEXT DEFAULT NULL,
    p_default_language TEXT DEFAULT 'ru'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_language TEXT;
    v_email TEXT;
BEGIN
    IF p_telegram_id IS NULL OR p_telegram_id <= 0 THEN
        RAISE EXCEPTION 'Geçersiz Telegram ID';
    END IF;

    -- Kullanıcı bağlıysa UUID'sini gönder (Gölge veya Asıl olması fark etmez)
    SELECT u.user_id, s.preferred_language 
    INTO v_user_id, v_language
    FROM public.telegram_users u
    LEFT JOIN public.user_settings s ON u.user_id = s.user_id
    WHERE u.telegram_id = p_telegram_id;
    
    IF v_user_id IS NOT NULL THEN
        IF p_username IS NOT NULL THEN
            UPDATE public.telegram_users 
            SET telegram_username = p_username 
            WHERE telegram_id = p_telegram_id AND (telegram_username IS NULL OR telegram_username != p_username);
        END IF;
        RETURN jsonb_build_object('user_id', v_user_id, 'language', COALESCE(v_language, p_default_language));
    END IF;

    -- Yeni kullanıcı: Sistemde gölge hesap oluştur
    v_user_id := gen_random_uuid();
    v_email := 'tg_' || p_telegram_id::TEXT || '@fintechterms.bot';
    
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, 
        email_confirmed_at, created_at, updated_at, 
        raw_app_meta_data, raw_user_meta_data
    )
    VALUES (
        v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
        v_email, 
        crypt(gen_random_uuid()::text, gen_salt('bf')),
        NOW(), NOW(), NOW(),
        '{"provider": "telegram", "providers": ["telegram"]}'::jsonb,
        jsonb_build_object('telegram_id', p_telegram_id, 'username', p_username)
    );

    INSERT INTO public.telegram_users (telegram_id, user_id, telegram_username)
    VALUES (p_telegram_id, v_user_id, p_username);

    INSERT INTO public.user_settings (user_id, preferred_language)
    VALUES (v_user_id, p_default_language) ON CONFLICT DO NOTHING;

    INSERT INTO public.user_progress (user_id)
    VALUES (v_user_id) ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('user_id', v_user_id, 'language', p_default_language);
END;
$$;


-- 6. Günlük İstatistik (Daily Learning Log) Upsert Fonksiyonu
CREATE OR REPLACE FUNCTION public.log_daily_learning(
    p_user_id UUID,
    p_words_reviewed INT DEFAULT 0,
    p_words_correct INT DEFAULT 0,
    p_words_incorrect INT DEFAULT 0,
    p_new_words_learned INT DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date DATE := CURRENT_DATE;
BEGIN
    INSERT INTO public.daily_learning_log (
        user_id, log_date, words_reviewed, words_correct, words_incorrect, new_words_learned
    ) VALUES (
        p_user_id, v_date, p_words_reviewed, p_words_correct, p_words_incorrect, p_new_words_learned
    )
    ON CONFLICT (user_id, log_date) 
    DO UPDATE SET
        words_reviewed = public.daily_learning_log.words_reviewed + EXCLUDED.words_reviewed,
        words_correct = public.daily_learning_log.words_correct + EXCLUDED.words_correct,
        words_incorrect = public.daily_learning_log.words_incorrect + EXCLUDED.words_incorrect,
        new_words_learned = public.daily_learning_log.new_words_learned + EXCLUDED.new_words_learned,
        updated_at = NOW();
END;
$$;
