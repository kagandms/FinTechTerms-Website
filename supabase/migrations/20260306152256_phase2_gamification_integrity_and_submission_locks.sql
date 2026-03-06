create table if not exists public.api_idempotency_keys (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    action text not null,
    idempotency_key text not null,
    request_hash text not null,
    status text not null default 'in_progress',
    response_code integer,
    response_body jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    completed_at timestamptz,
    constraint api_idempotency_keys_unique unique (user_id, action, idempotency_key),
    constraint api_idempotency_keys_status_check check (
        status in ('in_progress', 'completed', 'failed')
    )
);

create index if not exists idx_api_idempotency_keys_user_action_created_at
    on public.api_idempotency_keys (user_id, action, created_at desc);

drop trigger if exists update_api_idempotency_keys_updated_at on public.api_idempotency_keys;
create trigger update_api_idempotency_keys_updated_at
    before update on public.api_idempotency_keys
    for each row
    execute function public.update_updated_at_column();

alter table public.api_idempotency_keys enable row level security;

drop policy if exists "Service role can manage api idempotency keys" on public.api_idempotency_keys;
create policy "Service role can manage api idempotency keys"
    on public.api_idempotency_keys
    for all
    to service_role
    using (true)
    with check (true);

alter table public.quiz_attempts
    add column if not exists idempotency_key text;

create unique index if not exists idx_quiz_attempts_user_idempotency_key
    on public.quiz_attempts (user_id, idempotency_key)
    where idempotency_key is not null;

create index if not exists idx_quiz_attempts_user_created_at_desc
    on public.quiz_attempts (user_id, created_at desc);

create or replace function public.get_user_streak_summary(
    p_user_id uuid default auth.uid()
) returns table (
    current_streak integer,
    last_study_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_target_user_id uuid := coalesce(p_user_id, auth.uid());
    v_today date := timezone('utc', now())::date;
    v_last_study_date date;
    v_current_streak integer := 0;
begin
    if v_target_user_id is null then
        return query
        select 0::integer, null::date;
        return;
    end if;

    if v_request_role <> 'service_role'
       and auth.uid() is distinct from v_target_user_id then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    with active_days as (
        select distinct (timezone('utc', qa.created_at))::date as study_date
        from public.quiz_attempts as qa
        where qa.user_id = v_target_user_id
          and qa.created_at is not null
          and (timezone('utc', qa.created_at))::date <= v_today
    )
    select max(active_days.study_date)
    into v_last_study_date
    from active_days;

    if v_last_study_date is null then
        return query
        select 0::integer, null::date;
        return;
    end if;

    if v_last_study_date < (v_today - 1) then
        return query
        select 0::integer, v_last_study_date;
        return;
    end if;

    with recursive active_days as (
        select distinct (timezone('utc', qa.created_at))::date as study_date
        from public.quiz_attempts as qa
        where qa.user_id = v_target_user_id
          and qa.created_at is not null
          and (timezone('utc', qa.created_at))::date <= v_today
    ),
    streak_days as (
        select v_last_study_date as study_date
        union all
        select (streak_days.study_date - interval '1 day')::date
        from streak_days
        where exists (
            select 1
            from active_days
            where active_days.study_date = (streak_days.study_date - interval '1 day')::date
        )
    )
    select count(*)::integer
    into v_current_streak
    from streak_days;

    return query
    select
        coalesce(v_current_streak, 0),
        v_last_study_date;
end;
$$;

create or replace function public.recalculate_user_streak(p_user_id uuid)
returns table (
    current_streak integer,
    last_study_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_current_streak integer := 0;
    v_last_study_date date;
begin
    select streak.current_streak, streak.last_study_date
    into v_current_streak, v_last_study_date
    from public.get_user_streak_summary(p_user_id) as streak;

    insert into public.user_progress (
        user_id,
        current_streak,
        last_study_date
    )
    values (
        p_user_id,
        coalesce(v_current_streak, 0),
        case
            when v_last_study_date is null then null
            else v_last_study_date::timestamptz
        end
    )
    on conflict (user_id) do update
    set
        current_streak = excluded.current_streak,
        last_study_date = excluded.last_study_date,
        updated_at = timezone('utc', now());

    return query
    select
        coalesce(v_current_streak, 0),
        v_last_study_date;
end;
$$;

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
    v_progress public.user_progress%rowtype;
    v_term public.user_term_srs%rowtype;
    v_current_streak integer := 0;
    v_last_study_date date;
begin
    if v_request_role <> 'service_role' then
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

drop function if exists public.record_study_event(uuid, text, boolean, integer, text, date);

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

    if coalesce(p_response_time_ms, 0) < 0 then
        raise exception 'response_time_ms must be non-negative.'
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
        greatest(coalesce(p_response_time_ms, 0), 0),
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
        session_count
    )
    values (
        p_user_id,
        coalesce(p_log_date, current_date),
        1,
        case when p_is_correct then 1 else 0 end,
        case when p_is_correct then 0 else 1 end,
        case when v_is_first_review then 1 else 0 end,
        greatest(coalesce(p_response_time_ms, 0), 0) / 1000,
        1
    )
    on conflict (user_id, log_date) do update
    set
        words_reviewed = public.daily_learning_logs.words_reviewed + excluded.words_reviewed,
        words_correct = public.daily_learning_logs.words_correct + excluded.words_correct,
        words_incorrect = public.daily_learning_logs.words_incorrect + excluded.words_incorrect,
        new_words_learned = public.daily_learning_logs.new_words_learned + excluded.new_words_learned,
        time_spent_seconds = public.daily_learning_logs.time_spent_seconds + excluded.time_spent_seconds,
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

revoke all on public.api_idempotency_keys from public, anon, authenticated;
grant select, insert, update, delete on public.api_idempotency_keys to service_role;

revoke all on function public.get_user_streak_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_user_streak_summary(uuid) to authenticated, service_role;

revoke all on function public.build_record_study_event_response(uuid, text) from public, anon, authenticated;
grant execute on function public.build_record_study_event_response(uuid, text) to service_role;

revoke all on function public.record_study_event(uuid, text, boolean, integer, text, date, text) from public, anon, authenticated;
grant execute on function public.record_study_event(uuid, text, boolean, integer, text, date, text) to service_role;
