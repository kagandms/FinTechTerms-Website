create or replace function public.record_study_event(
    p_user_id uuid,
    p_term_id text,
    p_is_correct boolean,
    p_response_time_ms integer default 0,
    p_quiz_type text default 'daily',
    p_log_date date default current_date,
    p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_caller_user_id uuid := auth.uid();
    v_existing_attempt public.quiz_attempts%rowtype;
    v_inserted_attempt_id uuid;
    v_existing_srs public.user_term_srs%rowtype;
    v_current_level integer;
    v_current_difficulty numeric;
    v_current_retention numeric;
    v_new_level integer;
    v_new_difficulty numeric;
    v_new_retention numeric;
    v_interval_days integer;
    v_next_review_date timestamptz;
    v_last_reviewed timestamptz := timezone('utc', now());
    v_times_reviewed integer;
    v_times_correct integer;
    v_is_first_review boolean;
    v_response_time_ms integer := greatest(coalesce(p_response_time_ms, 0), 0);
begin
    if v_request_role <> 'service_role'
       and v_caller_user_id is distinct from p_user_id then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    if p_user_id is null or coalesce(trim(p_term_id), '') = '' then
        raise exception 'User and term are required.'
            using errcode = '22023';
    end if;

    if coalesce(trim(p_idempotency_key), '') = '' then
        raise exception 'idempotency_key is required.'
            using errcode = '22023';
    end if;

    if p_quiz_type not in ('daily', 'practice', 'review', 'simulation', 'telegram_bot') then
        raise exception 'Invalid quiz_type.'
            using errcode = '22023';
    end if;

    insert into public.user_progress (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select *
    into v_existing_attempt
    from public.quiz_attempts
    where user_id = p_user_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if found then
        if v_existing_attempt.term_id is distinct from p_term_id then
            raise exception 'Idempotency key already used for a different study event.'
                using errcode = '23505';
        end if;

        return public.build_record_study_event_response(p_user_id, p_term_id);
    end if;

    if not exists (
        select 1
        from public.user_favorites
        where user_id = p_user_id
          and term_id = p_term_id
    ) then
        raise exception 'Term must be favorited before review.'
            using errcode = '23514';
    end if;

    insert into public.quiz_attempts (
        user_id,
        term_id,
        is_correct,
        response_time_ms,
        quiz_type,
        created_at,
        idempotency_key
    )
    values (
        p_user_id,
        p_term_id,
        p_is_correct,
        v_response_time_ms,
        p_quiz_type,
        timezone('utc', now()),
        p_idempotency_key
    )
    on conflict (user_id, idempotency_key) do nothing
    returning id into v_inserted_attempt_id;

    if v_inserted_attempt_id is null then
        select *
        into v_existing_attempt
        from public.quiz_attempts
        where user_id = p_user_id
          and idempotency_key = p_idempotency_key
        limit 1;

        if found and v_existing_attempt.term_id is distinct from p_term_id then
            raise exception 'Idempotency key already used for a different study event.'
                using errcode = '23505';
        end if;

        return public.build_record_study_event_response(p_user_id, p_term_id);
    end if;

    select *
    into v_existing_srs
    from public.user_term_srs
    where user_id = p_user_id
      and term_id = p_term_id
    for update;

    v_current_level := greatest(coalesce(v_existing_srs.srs_level, 1), 1);
    v_current_difficulty := coalesce(v_existing_srs.difficulty_score, 2.5);
    v_current_retention := coalesce(v_existing_srs.retention_rate, 0);
    v_times_reviewed := coalesce(v_existing_srs.times_reviewed, 0) + 1;
    v_times_correct := coalesce(v_existing_srs.times_correct, 0) + case when p_is_correct then 1 else 0 end;
    v_is_first_review := coalesce(v_existing_srs.times_reviewed, 0) = 0;

    if p_is_correct then
        v_new_level := least(v_current_level + 1, 5);
        v_new_difficulty := greatest(0, least(5, v_current_difficulty - 0.1));
        v_new_retention := greatest(0, least(1, v_current_retention + 0.05));
    else
        v_new_level := 1;
        v_new_difficulty := greatest(0, least(5, v_current_difficulty + 0.3));
        v_new_retention := greatest(0, least(1, v_current_retention - 0.1));
    end if;

    v_interval_days := case v_new_level
        when 1 then 1
        when 2 then 3
        when 3 then 7
        when 4 then 14
        else 30
    end;
    v_next_review_date := date_trunc('day', v_last_reviewed + make_interval(days => v_interval_days));

    insert into public.user_term_srs (
        user_id,
        term_id,
        srs_level,
        next_review_date,
        last_reviewed,
        difficulty_score,
        retention_rate,
        times_reviewed,
        times_correct
    )
    values (
        p_user_id,
        p_term_id,
        v_new_level,
        v_next_review_date,
        v_last_reviewed,
        round(v_new_difficulty::numeric, 2),
        round(v_new_retention::numeric, 2),
        v_times_reviewed,
        v_times_correct
    )
    on conflict (user_id, term_id) do update
    set
        srs_level = excluded.srs_level,
        next_review_date = excluded.next_review_date,
        last_reviewed = excluded.last_reviewed,
        difficulty_score = excluded.difficulty_score,
        retention_rate = excluded.retention_rate,
        times_reviewed = excluded.times_reviewed,
        times_correct = excluded.times_correct;

    insert into public.daily_learning_logs (
        user_id,
        log_date,
        words_reviewed,
        words_correct,
        words_incorrect,
        new_words_learned,
        time_spent_seconds,
        time_spent_ms,
        session_count
    )
    values (
        p_user_id,
        coalesce(p_log_date, current_date),
        1,
        case when p_is_correct then 1 else 0 end,
        case when p_is_correct then 0 else 1 end,
        case when v_is_first_review and p_is_correct then 1 else 0 end,
        round(v_response_time_ms::numeric / 1000)::integer,
        v_response_time_ms,
        1
    )
    on conflict (user_id, log_date) do update
    set
        words_reviewed = public.daily_learning_logs.words_reviewed + excluded.words_reviewed,
        words_correct = public.daily_learning_logs.words_correct + excluded.words_correct,
        words_incorrect = public.daily_learning_logs.words_incorrect + excluded.words_incorrect,
        new_words_learned = public.daily_learning_logs.new_words_learned + excluded.new_words_learned,
        time_spent_seconds = public.daily_learning_logs.time_spent_seconds + excluded.time_spent_seconds,
        time_spent_ms = public.daily_learning_logs.time_spent_ms + excluded.time_spent_ms,
        session_count = public.daily_learning_logs.session_count + excluded.session_count,
        updated_at = timezone('utc', now());

    perform public.recalculate_user_streak(p_user_id);

    update public.user_progress
    set
        total_words_learned = (
            select count(*)
            from public.user_term_srs
            where user_id = p_user_id
              and srs_level >= 4
        ),
        updated_at = timezone('utc', now())
    where user_id = p_user_id;

    return public.build_record_study_event_response(p_user_id, p_term_id);
end;
$$;

revoke all on function public.record_study_event(uuid, text, boolean, integer, text, date, text) from public, anon, authenticated;
grant execute on function public.record_study_event(uuid, text, boolean, integer, text, date, text) to service_role;

create or replace function public.verify_release_readiness()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
    checks jsonb;
    is_ok boolean;
begin
    checks := jsonb_build_object(
        'terms_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'terms'
        ),
        'profiles_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'profiles'
        ),
        'user_progress_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'user_progress'
        ),
        'quiz_attempts_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'quiz_attempts'
        ),
        'user_term_srs_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'user_term_srs'
        ),
        'user_settings_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'user_settings'
        ),
        'user_favorites_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'user_favorites'
        ),
        'profiles_rls_enabled',
        exists (
            select 1
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname = 'profiles'
              and c.relrowsecurity = true
        ),
        'terms_rls_enabled',
        exists (
            select 1
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname = 'terms'
              and c.relrowsecurity = true
        ),
        'study_sessions_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'study_sessions'
        ),
        'study_sessions_session_token_hash_column',
        exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'study_sessions'
              and column_name = 'session_token_hash'
        ),
        'daily_learning_logs_time_spent_ms_column',
        exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'daily_learning_logs'
              and column_name = 'time_spent_ms'
        ),
        'study_sessions_user_idempotency_index',
        exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'study_sessions'
              and indexname = 'idx_study_sessions_user_idempotency_key'
        ),
        'study_sessions_anonymous_idempotency_index',
        exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'study_sessions'
              and indexname = 'idx_study_sessions_anonymous_idempotency_key'
        ),
        'anon_cannot_insert_study_sessions',
        not has_table_privilege('anon', 'public.study_sessions', 'INSERT'),
        'authenticated_cannot_insert_study_sessions',
        not has_table_privilege('authenticated', 'public.study_sessions', 'INSERT'),
        'search_terms_trigram_exists',
        exists (
            select 1
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = 'search_terms_trigram'
        ),
        'terms_public_select_granted',
        has_table_privilege('anon', 'public.terms', 'SELECT')
            and has_table_privilege('authenticated', 'public.terms', 'SELECT'),
        'service_role_can_execute_record_study_event',
        has_function_privilege(
            'service_role',
            'public.record_study_event(uuid, text, boolean, integer, text, date, text)',
            'EXECUTE'
        ),
        'authenticated_cannot_execute_record_study_event',
        not has_function_privilege(
            'authenticated',
            'public.record_study_event(uuid, text, boolean, integer, text, date, text)',
            'EXECUTE'
        ),
        'first_wrong_review_does_not_increment_new_words',
        exists (
            select 1
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = 'record_study_event'
              and replace(pg_get_functiondef(p.oid), E'\n', ' ') like '%case when v_is_first_review and p_is_correct then 1 else 0 end%'
        )
    );

    select bool_and(value::boolean)
    into is_ok
    from jsonb_each_text(checks);

    return jsonb_build_object(
        'ok', coalesce(is_ok, false),
        'checks', checks
    );
end;
$$;
