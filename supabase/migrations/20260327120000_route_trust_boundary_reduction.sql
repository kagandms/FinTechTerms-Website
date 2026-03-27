drop policy if exists "Authenticated users can manage own api idempotency keys" on public.api_idempotency_keys;
create policy "Authenticated users can manage own api idempotency keys"
    on public.api_idempotency_keys
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

revoke all on public.api_idempotency_keys from authenticated;
grant select, insert, update, delete on public.api_idempotency_keys to authenticated;

create or replace function public.toggle_user_favorite(
    p_user_id uuid,
    p_term_id text,
    p_should_favorite boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_caller_user_id uuid := auth.uid();
    v_favorites jsonb;
    v_is_favorite boolean;
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

    if not exists (
        select 1
        from public.terms
        where id = p_term_id
    ) then
        raise exception 'Term not found.'
            using errcode = 'P0002';
    end if;

    if p_should_favorite then
        insert into public.user_favorites (
            user_id,
            term_id,
            source
        )
        values (
            p_user_id,
            p_term_id,
            'web'
        )
        on conflict (user_id, term_id) do nothing;
    else
        delete from public.user_favorites
        where user_id = p_user_id
          and term_id = p_term_id;
    end if;

    select exists (
        select 1
        from public.user_favorites
        where user_id = p_user_id
          and term_id = p_term_id
    )
    into v_is_favorite;

    select coalesce(
        jsonb_agg(uf.term_id order by uf.created_at desc),
        '[]'::jsonb
    )
    into v_favorites
    from public.user_favorites as uf
    where uf.user_id = p_user_id;

    return jsonb_build_object(
        'success', true,
        'termId', p_term_id,
        'isFavorite', v_is_favorite,
        'favorites', v_favorites
    );
end;
$$;

create or replace function public.toggle_my_favorite(
    p_term_id text,
    p_should_favorite boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    return public.toggle_user_favorite(v_user_id, p_term_id, p_should_favorite);
end;
$$;

revoke all on function public.toggle_my_favorite(text, boolean) from public, anon;
grant execute on function public.toggle_my_favorite(text, boolean) to authenticated;

create or replace function public.build_record_study_event_response(
    p_user_id uuid,
    p_term_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_caller_user_id uuid := auth.uid();
    v_progress public.user_progress%rowtype;
    v_term public.user_term_srs%rowtype;
    v_current_streak integer := 0;
    v_last_study_date date;
begin
    if v_request_role <> 'service_role'
       and v_caller_user_id is distinct from p_user_id then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    select *
    into v_progress
    from public.user_progress
    where user_id = p_user_id;

    select *
    into v_term
    from public.user_term_srs
    where user_id = p_user_id
      and term_id = p_term_id;

    select streak.current_streak, streak.last_study_date
    into v_current_streak, v_last_study_date
    from public.get_user_streak_summary(p_user_id) as streak;

    return jsonb_build_object(
        'userProgress', jsonb_build_object(
            'current_streak', coalesce(v_current_streak, 0),
            'last_study_date', v_last_study_date,
            'total_words_learned', coalesce(v_progress.total_words_learned, 0),
            'updated_at', v_progress.updated_at
        ),
        'termSrs', jsonb_build_object(
            'term_id', p_term_id,
            'srs_level', coalesce(v_term.srs_level, 1),
            'next_review_date', v_term.next_review_date,
            'last_reviewed', v_term.last_reviewed,
            'difficulty_score', coalesce(v_term.difficulty_score, 2.5),
            'retention_rate', coalesce(v_term.retention_rate, 0),
            'times_reviewed', coalesce(v_term.times_reviewed, 0),
            'times_correct', coalesce(v_term.times_correct, 0)
        )
    );
end;
$$;

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

create or replace function public.record_my_study_event(
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
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    return public.record_study_event(
        v_user_id,
        p_term_id,
        p_is_correct,
        p_response_time_ms,
        p_quiz_type,
        p_log_date,
        p_idempotency_key
    );
end;
$$;

revoke all on function public.record_my_study_event(text, boolean, integer, text, date, text) from public, anon;
grant execute on function public.record_my_study_event(text, boolean, integer, text, date, text) to authenticated;

create or replace function public.start_study_session(
    p_anonymous_id text,
    p_device_type text,
    p_user_agent text,
    p_consent_given boolean,
    p_idempotency_key text,
    p_previous_session_id uuid default null,
    p_previous_session_token_hash text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_existing_session public.study_sessions%rowtype;
    v_session_id uuid;
begin
    if coalesce(trim(p_idempotency_key), '') = '' then
        raise exception 'idempotency_key is required.'
            using errcode = '22023';
    end if;

    if p_device_type not in ('mobile', 'tablet', 'desktop', 'unknown') then
        raise exception 'Invalid device type.'
            using errcode = '22023';
    end if;

    if p_consent_given is distinct from true then
        raise exception 'Consent is required.'
            using errcode = '22023';
    end if;

    if v_user_id is null and coalesce(trim(p_anonymous_id), '') = '' then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    if v_user_id is not null and p_previous_session_id is not null then
        select *
        into v_existing_session
        from public.study_sessions
        where id = p_previous_session_id
        for update;

        if not found then
            raise exception 'Previous study session not found.'
                using errcode = 'P0002';
        end if;

        if coalesce(trim(p_previous_session_token_hash), '') = ''
           or v_existing_session.session_token_hash is distinct from p_previous_session_token_hash then
            raise exception 'Previous study session does not belong to this requester.'
                using errcode = '42501';
        end if;

        if v_existing_session.user_id is not null
           and v_existing_session.user_id <> v_user_id then
            raise exception 'Previous study session does not belong to this requester.'
                using errcode = '42501';
        end if;

        update public.study_sessions
        set user_id = v_user_id
        where id = p_previous_session_id;
    end if;

    begin
        insert into public.study_sessions (
            user_id,
            anonymous_id,
            idempotency_key,
            session_start,
            device_type,
            user_agent,
            consent_given,
            consent_timestamp
        )
        values (
            v_user_id,
            case
                when v_user_id is null then nullif(trim(p_anonymous_id), '')
                else null
            end,
            p_idempotency_key,
            timezone('utc', now()),
            p_device_type,
            p_user_agent,
            true,
            timezone('utc', now())
        )
        returning id into v_session_id;

        return v_session_id;
    exception
        when unique_violation then
            if v_user_id is not null then
                select id
                into v_session_id
                from public.study_sessions
                where user_id = v_user_id
                  and idempotency_key = p_idempotency_key
                limit 1;
            else
                select id
                into v_session_id
                from public.study_sessions
                where anonymous_id = nullif(trim(p_anonymous_id), '')
                  and idempotency_key = p_idempotency_key
                limit 1;
            end if;

            if v_session_id is null then
                raise;
            end if;

            return v_session_id;
    end;
end;
$$;

revoke all on function public.start_study_session(text, text, text, boolean, text, uuid, text) from public;
grant execute on function public.start_study_session(text, text, text, boolean, text, uuid, text) to anon, authenticated;

create or replace function public.bind_study_session_token(
    p_session_id uuid,
    p_idempotency_key text,
    p_session_token_hash text,
    p_anonymous_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if p_session_id is null
       or coalesce(trim(p_idempotency_key), '') = ''
       or coalesce(trim(p_session_token_hash), '') = '' then
        raise exception 'Study session token binding requires session id, token hash, and idempotency key.'
            using errcode = '22023';
    end if;

    update public.study_sessions
    set session_token_hash = p_session_token_hash
    where id = p_session_id
      and idempotency_key = p_idempotency_key
      and (
          (v_user_id is not null and user_id = v_user_id)
          or (
              v_user_id is null
              and user_id is null
              and anonymous_id = nullif(trim(p_anonymous_id), '')
          )
      )
      and (
          session_token_hash is null
          or session_token_hash = p_session_token_hash
      );

    if found then
        return;
    end if;

    if exists (
        select 1
        from public.study_sessions
        where id = p_session_id
    ) then
        raise exception 'Study session does not belong to this requester.'
            using errcode = '42501';
    end if;

    raise exception 'Study session not found.'
        using errcode = 'P0002';
end;
$$;

revoke all on function public.bind_study_session_token(uuid, text, text, text) from public;
grant execute on function public.bind_study_session_token(uuid, text, text, text) to anon, authenticated;

create or replace function public.update_study_session_by_token(
    p_session_id uuid,
    p_session_token_hash text,
    p_duration_seconds integer,
    p_page_views integer,
    p_quiz_attempts integer,
    p_end_session boolean,
    p_ended_at timestamptz default timezone('utc', now())
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_session public.study_sessions%rowtype;
begin
    select *
    into v_session
    from public.study_sessions
    where id = p_session_id
    for update;

    if not found then
        raise exception 'Study session not found.'
            using errcode = 'P0002';
    end if;

    if coalesce(trim(p_session_token_hash), '') = ''
       or v_session.session_token_hash is distinct from p_session_token_hash then
        raise exception 'Study session does not belong to this requester.'
            using errcode = '42501';
    end if;

    if v_session.user_id is not null then
        if v_user_id is distinct from v_session.user_id then
            raise exception 'Study session does not belong to this requester.'
                using errcode = '42501';
        end if;
    elsif v_user_id is not null then
        raise exception 'Study session does not belong to this requester.'
            using errcode = '42501';
    end if;

    update public.study_sessions
    set
        duration_seconds = greatest(
            coalesce(duration_seconds, 0),
            greatest(coalesce(p_duration_seconds, 0), 0)
        ),
        page_views = greatest(
            coalesce(page_views, 0),
            greatest(coalesce(p_page_views, 0), 0)
        ),
        quiz_attempts = greatest(
            coalesce(quiz_attempts, 0),
            greatest(coalesce(p_quiz_attempts, 0), 0)
        ),
        session_end = case
            when p_end_session then coalesce(session_end, coalesce(p_ended_at, timezone('utc', now())))
            else session_end
        end,
        updated_at = timezone('utc', now())
    where id = p_session_id;
end;
$$;

revoke all on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) from public;
grant execute on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) to anon, authenticated;
