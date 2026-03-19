alter table public.daily_learning_logs
    add column if not exists time_spent_ms bigint not null default 0;

update public.daily_learning_logs
set time_spent_ms = greatest(coalesce(time_spent_ms, 0), greatest(coalesce(time_spent_seconds, 0), 0) * 1000);

do $$
begin
    if to_regclass('public.daily_learning_log') is not null then
        execute 'alter table public.daily_learning_log add column if not exists time_spent_ms bigint not null default 0';
        execute 'update public.daily_learning_log set time_spent_ms = greatest(coalesce(time_spent_ms, 0), greatest(coalesce(time_spent_seconds, 0), 0) * 1000)';
    end if;
end;
$$;

alter table public.daily_learning_logs
    drop constraint if exists daily_learning_logs_time_spent_ms_non_negative;

alter table public.daily_learning_logs
    add constraint daily_learning_logs_time_spent_ms_non_negative
    check (time_spent_ms >= 0);

drop function if exists public.get_user_learning_heatmap();

create or replace function public.get_user_learning_heatmap()
returns table (
    log_date date,
    words_reviewed integer,
    words_correct integer,
    words_incorrect integer,
    new_words_learned integer,
    time_spent_seconds integer,
    time_spent_ms bigint,
    session_count integer,
    activity_count integer
)
language sql
stable
as $$
    with day_series as (
        select generate_series(
            current_date - interval '364 days',
            current_date,
            interval '1 day'
        )::date as log_date
    ),
    aggregated_logs as (
        select
            dll.log_date,
            sum(dll.words_reviewed)::integer as words_reviewed,
            sum(dll.words_correct)::integer as words_correct,
            sum(dll.words_incorrect)::integer as words_incorrect,
            sum(dll.new_words_learned)::integer as new_words_learned,
            sum(
                coalesce(
                    dll.time_spent_ms,
                    greatest(coalesce(dll.time_spent_seconds, 0), 0)::bigint * 1000
                )
            )::bigint as time_spent_ms,
            sum(dll.session_count)::integer as session_count,
            (
                sum(dll.words_reviewed)
                + sum(dll.new_words_learned)
                + greatest(sum(dll.session_count), 0)
            )::integer as activity_count
        from public.daily_learning_logs as dll
        where dll.user_id = auth.uid()
          and dll.log_date between current_date - interval '364 days' and current_date
        group by dll.log_date
    )
    select
        day_series.log_date,
        coalesce(aggregated_logs.words_reviewed, 0) as words_reviewed,
        coalesce(aggregated_logs.words_correct, 0) as words_correct,
        coalesce(aggregated_logs.words_incorrect, 0) as words_incorrect,
        coalesce(aggregated_logs.new_words_learned, 0) as new_words_learned,
        round(coalesce(aggregated_logs.time_spent_ms, 0)::numeric / 1000)::integer as time_spent_seconds,
        coalesce(aggregated_logs.time_spent_ms, 0)::bigint as time_spent_ms,
        coalesce(aggregated_logs.session_count, 0) as session_count,
        coalesce(aggregated_logs.activity_count, 0) as activity_count
    from day_series
    left join aggregated_logs
        on aggregated_logs.log_date = day_series.log_date
    order by day_series.log_date asc;
$$;

revoke all on function public.get_user_learning_heatmap() from public, anon;
grant execute on function public.get_user_learning_heatmap() to authenticated;

create or replace function public.increment_daily_learning_log(
    p_log_date date default current_date,
    p_words_reviewed integer default 0,
    p_words_correct integer default 0,
    p_words_incorrect integer default 0,
    p_new_words_learned integer default 0,
    p_time_spent_seconds integer default 0
)
returns public.daily_learning_logs
language plpgsql
as $$
declare
    v_user_id uuid := auth.uid();
    v_log public.daily_learning_logs;
    v_time_spent_ms bigint := greatest(coalesce(p_time_spent_seconds, 0), 0)::bigint * 1000;
begin
    if v_user_id is null then
        raise exception using errcode = '42501', message = 'Authentication required';
    end if;

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
        v_user_id,
        coalesce(p_log_date, current_date),
        greatest(coalesce(p_words_reviewed, 0), 0),
        greatest(coalesce(p_words_correct, 0), 0),
        greatest(coalesce(p_words_incorrect, 0), 0),
        greatest(coalesce(p_new_words_learned, 0), 0),
        greatest(coalesce(p_time_spent_seconds, 0), 0),
        v_time_spent_ms,
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
        session_count = greatest(public.daily_learning_logs.session_count, 1),
        updated_at = timezone('utc', now())
    returning * into v_log;

    return v_log;
end;
$$;

revoke all on function public.increment_daily_learning_log(date, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.increment_daily_learning_log(date, integer, integer, integer, integer, integer) to authenticated;

create or replace function public.merge_shadow_user_state(
    p_target_user_id uuid,
    p_shadow_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_target_user_id is null
       or p_shadow_user_id is null
       or p_target_user_id = p_shadow_user_id then
        return;
    end if;

    insert into public.user_progress (user_id)
    values (p_target_user_id)
    on conflict (user_id) do nothing;

    update public.quiz_attempts
    set user_id = p_target_user_id
    where user_id = p_shadow_user_id;

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
    select
        p_target_user_id,
        uts_shadow.term_id,
        greatest(coalesce(uts_target.srs_level, 1), coalesce(uts_shadow.srs_level, 1)),
        case
            when uts_target.next_review_date is null then uts_shadow.next_review_date
            when uts_shadow.next_review_date is null then uts_target.next_review_date
            else least(uts_target.next_review_date, uts_shadow.next_review_date)
        end,
        case
            when uts_target.last_reviewed is null then uts_shadow.last_reviewed
            when uts_shadow.last_reviewed is null then uts_target.last_reviewed
            else greatest(uts_target.last_reviewed, uts_shadow.last_reviewed)
        end,
        greatest(coalesce(uts_target.difficulty_score, 2.5), coalesce(uts_shadow.difficulty_score, 2.5)),
        case
            when (coalesce(uts_target.times_reviewed, 0) + coalesce(uts_shadow.times_reviewed, 0)) = 0 then
                greatest(coalesce(uts_target.retention_rate, 0), coalesce(uts_shadow.retention_rate, 0))
            else round((
                (
                    coalesce(uts_target.retention_rate, 0) * coalesce(uts_target.times_reviewed, 0)
                )
                + (
                    coalesce(uts_shadow.retention_rate, 0) * coalesce(uts_shadow.times_reviewed, 0)
                )
            ) / nullif(
                coalesce(uts_target.times_reviewed, 0) + coalesce(uts_shadow.times_reviewed, 0),
                0
            )::numeric, 2)
        end,
        coalesce(uts_target.times_reviewed, 0) + coalesce(uts_shadow.times_reviewed, 0),
        coalesce(uts_target.times_correct, 0) + coalesce(uts_shadow.times_correct, 0)
    from public.user_term_srs as uts_shadow
    left join public.user_term_srs as uts_target
        on uts_target.user_id = p_target_user_id
       and uts_target.term_id = uts_shadow.term_id
    where uts_shadow.user_id = p_shadow_user_id
    on conflict (user_id, term_id) do update
    set
        srs_level = excluded.srs_level,
        next_review_date = excluded.next_review_date,
        last_reviewed = excluded.last_reviewed,
        difficulty_score = excluded.difficulty_score,
        retention_rate = excluded.retention_rate,
        times_reviewed = excluded.times_reviewed,
        times_correct = excluded.times_correct;

    delete from public.user_term_srs
    where user_id = p_shadow_user_id;

    insert into public.user_favorites (
        user_id,
        term_id,
        created_at,
        source
    )
    select
        p_target_user_id,
        uf.term_id,
        coalesce(uf.created_at, timezone('utc', now())),
        'telegram_account_merge'
    from public.user_favorites as uf
    where uf.user_id = p_shadow_user_id
    on conflict (user_id, term_id) do nothing;

    delete from public.user_favorites
    where user_id = p_shadow_user_id;

    insert into public.daily_learning_logs (
        user_id,
        log_date,
        words_reviewed,
        words_correct,
        words_incorrect,
        new_words_learned,
        time_spent_seconds,
        time_spent_ms,
        session_count,
        created_at,
        updated_at
    )
    select
        p_target_user_id,
        dll.log_date,
        dll.words_reviewed,
        dll.words_correct,
        dll.words_incorrect,
        dll.new_words_learned,
        dll.time_spent_seconds,
        coalesce(dll.time_spent_ms, greatest(coalesce(dll.time_spent_seconds, 0), 0)::bigint * 1000),
        dll.session_count,
        coalesce(dll.created_at, timezone('utc', now())),
        coalesce(dll.updated_at, timezone('utc', now()))
    from public.daily_learning_logs as dll
    where dll.user_id = p_shadow_user_id
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

    delete from public.daily_learning_logs
    where user_id = p_shadow_user_id;

    perform public.recalculate_user_streak(p_target_user_id);

    update public.user_progress
    set
        total_words_learned = (
            select count(*)
            from public.user_term_srs
            where user_id = p_target_user_id
              and srs_level >= 4
        ),
        updated_at = timezone('utc', now())
    where user_id = p_target_user_id;
end;
$$;

revoke all on function public.merge_shadow_user_state(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_shadow_user_state(uuid, uuid) to service_role;

drop function if exists public.record_study_event(uuid, text, boolean, integer, text, date, text);

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
    if v_request_role <> 'service_role' then
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
        case when v_is_first_review then 1 else 0 end,
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
