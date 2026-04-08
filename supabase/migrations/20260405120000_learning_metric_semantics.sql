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
    with utc_today as (
        select timezone('utc', now())::date as value
    ),
    day_series as (
        select generate_series(
            (select value from utc_today) - interval '364 days',
            (select value from utc_today),
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
            )::bigint as time_spent_ms
        from public.daily_learning_logs as dll
        where dll.user_id = auth.uid()
          and dll.log_date between (select value from utc_today) - interval '364 days' and (select value from utc_today)
        group by dll.log_date
    ),
    aggregated_sessions as (
        select
            (timezone('utc', ss.session_start))::date as log_date,
            count(*)::integer as session_count
        from public.study_sessions as ss
        where ss.user_id = auth.uid()
          and ss.session_start is not null
          and (timezone('utc', ss.session_start))::date between (select value from utc_today) - interval '364 days' and (select value from utc_today)
        group by (timezone('utc', ss.session_start))::date
    )
    select
        day_series.log_date,
        coalesce(aggregated_logs.words_reviewed, 0) as words_reviewed,
        coalesce(aggregated_logs.words_correct, 0) as words_correct,
        coalesce(aggregated_logs.words_incorrect, 0) as words_incorrect,
        coalesce(aggregated_logs.new_words_learned, 0) as new_words_learned,
        round(coalesce(aggregated_logs.time_spent_ms, 0)::numeric / 1000)::integer as time_spent_seconds,
        coalesce(aggregated_logs.time_spent_ms, 0)::bigint as time_spent_ms,
        coalesce(aggregated_sessions.session_count, 0) as session_count,
        (
            coalesce(aggregated_logs.words_reviewed, 0)
            + greatest(coalesce(aggregated_sessions.session_count, 0), 0)
        )::integer as activity_count
    from day_series
    left join aggregated_logs
        on aggregated_logs.log_date = day_series.log_date
    left join aggregated_sessions
        on aggregated_sessions.log_date = day_series.log_date
    order by day_series.log_date asc;
$$;

create or replace function public.record_study_event(
    p_user_id uuid,
    p_term_id text,
    p_is_correct boolean,
    p_response_time_ms integer default 0,
    p_quiz_type text default 'daily',
    p_log_date date default null,
    p_idempotency_key text default null,
    p_session_id uuid default null,
    p_session_token_hash text default null
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
    v_effective_log_date date := coalesce(p_log_date, timezone('utc', now())::date);
    v_session public.study_sessions%rowtype;
    v_effective_session_id uuid := null;
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

    if p_session_id is not null or coalesce(trim(p_session_token_hash), '') <> '' then
        if p_session_id is null or coalesce(trim(p_session_token_hash), '') = '' then
            raise exception 'Session id and token hash must be provided together.'
                using errcode = '22023';
        end if;

        select *
        into v_session
        from public.study_sessions
        where id = p_session_id
        for update;

        if not found then
            raise exception 'Study session not found.'
                using errcode = 'P0002';
        end if;

        if v_session.session_token_hash is distinct from p_session_token_hash then
            raise exception 'Study session does not belong to this requester.'
                using errcode = '42501';
        end if;

        if v_session.user_id is distinct from p_user_id then
            raise exception 'Study session does not belong to this requester.'
                using errcode = '42501';
        end if;

        v_effective_session_id := v_session.id;
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

        if v_effective_session_id is not null then
            if v_existing_attempt.session_id is null then
                update public.quiz_attempts
                set session_id = v_effective_session_id
                where id = v_existing_attempt.id;
            elsif v_existing_attempt.session_id is distinct from v_effective_session_id then
                raise exception 'Idempotency key already linked to a different study session.'
                    using errcode = '23505';
            end if;

            update public.study_sessions
            set
                quiz_attempts = (
                    select count(*)
                    from public.quiz_attempts
                    where session_id = v_effective_session_id
                ),
                updated_at = timezone('utc', now())
            where id = v_effective_session_id;
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
        session_id,
        is_correct,
        response_time_ms,
        quiz_type,
        created_at,
        idempotency_key
    )
    values (
        p_user_id,
        p_term_id,
        v_effective_session_id,
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

        if v_effective_session_id is not null then
            update public.study_sessions
            set
                quiz_attempts = (
                    select count(*)
                    from public.quiz_attempts
                    where session_id = v_effective_session_id
                ),
                updated_at = timezone('utc', now())
            where id = v_effective_session_id;
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
    v_times_reviewed := coalesce(v_existing_srs.times_reviewed, 0) + 1;
    v_times_correct := coalesce(v_existing_srs.times_correct, 0) + case when p_is_correct then 1 else 0 end;
    v_is_first_review := coalesce(v_existing_srs.times_reviewed, 0) = 0;

    if p_is_correct then
        v_new_level := least(v_current_level + 1, 5);
        v_new_difficulty := greatest(0, least(5, v_current_difficulty - 0.1));
    else
        v_new_level := 1;
        v_new_difficulty := greatest(0, least(5, v_current_difficulty + 0.3));
    end if;

    v_new_retention := case
        when v_times_reviewed <= 0 then 0
        else round((v_times_correct::numeric / v_times_reviewed::numeric), 2)
    end;

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
        v_new_retention,
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
        v_effective_log_date,
        1,
        case when p_is_correct then 1 else 0 end,
        case when p_is_correct then 0 else 1 end,
        case when v_is_first_review and p_is_correct then 1 else 0 end,
        round(v_response_time_ms::numeric / 1000)::integer,
        v_response_time_ms,
        0
    )
    on conflict (user_id, log_date) do update
    set
        words_reviewed = public.daily_learning_logs.words_reviewed + excluded.words_reviewed,
        words_correct = public.daily_learning_logs.words_correct + excluded.words_correct,
        words_incorrect = public.daily_learning_logs.words_incorrect + excluded.words_incorrect,
        new_words_learned = public.daily_learning_logs.new_words_learned + excluded.new_words_learned,
        time_spent_seconds = public.daily_learning_logs.time_spent_seconds + excluded.time_spent_seconds,
        time_spent_ms = public.daily_learning_logs.time_spent_ms + excluded.time_spent_ms,
        updated_at = timezone('utc', now());

    if v_effective_session_id is not null then
        update public.study_sessions
        set
            quiz_attempts = (
                select count(*)
                from public.quiz_attempts
                where session_id = v_effective_session_id
            ),
            updated_at = timezone('utc', now())
        where id = v_effective_session_id;
    end if;

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
