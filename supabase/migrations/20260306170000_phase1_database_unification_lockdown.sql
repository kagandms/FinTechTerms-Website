create extension if not exists "uuid-ossp";

create table if not exists public.deprecated_migrations (
    migration_name text primary key,
    deprecated_reason text not null,
    superseded_by text not null,
    deprecated_at timestamptz not null default timezone('utc', now())
);

insert into public.deprecated_migrations (
    migration_name,
    deprecated_reason,
    superseded_by
)
values
    (
        'telegram-bot/migrations/001_bot_user_stats.sql',
        'Legacy bot-only stats table breaks the shared progress/log single source of truth.',
        'supabase/migrations/20260306170000_phase1_database_unification_lockdown.sql'
    ),
    (
        'telegram-bot/migrations/003_telegram_web_sync.sql',
        'Legacy Telegram/Web sync migration writes to deprecated favorites and daily_learning_log structures.',
        'supabase/migrations/20260306170000_phase1_database_unification_lockdown.sql'
    ),
    (
        'telegram-bot/migrations/004_fix_telegram_link_rpc.sql',
        'Legacy Telegram link fix still depends on deprecated split learning-log structures.',
        'supabase/migrations/20260306170000_phase1_database_unification_lockdown.sql'
    )
on conflict (migration_name) do update
set
    deprecated_reason = excluded.deprecated_reason,
    superseded_by = excluded.superseded_by,
    deprecated_at = timezone('utc', now());

create table if not exists public.user_favorites (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    term_id text not null references public.terms(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    source text not null default 'migration',
    constraint user_favorites_unique unique (user_id, term_id)
);

create index if not exists idx_user_favorites_user_created_at
    on public.user_favorites (user_id, created_at desc);

create index if not exists idx_user_favorites_term_id
    on public.user_favorites (term_id);

create table if not exists public.daily_learning_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    log_date date not null default current_date,
    words_reviewed integer not null default 0,
    words_correct integer not null default 0,
    words_incorrect integer not null default 0,
    new_words_learned integer not null default 0,
    time_spent_seconds integer not null default 0,
    session_count integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint daily_learning_logs_unique unique (user_id, log_date),
    constraint daily_learning_logs_non_negative check (
        words_reviewed >= 0
        and words_correct >= 0
        and words_incorrect >= 0
        and new_words_learned >= 0
        and time_spent_seconds >= 0
        and session_count >= 0
    )
);

create index if not exists idx_daily_learning_logs_user_date
    on public.daily_learning_logs (user_id, log_date desc);

create table if not exists public.user_badges (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    badge_key text not null,
    badge_type text not null default 'streak',
    streak_days integer,
    unlocked_at timestamptz not null default timezone('utc', now()),
    source_log_date date,
    metadata jsonb not null default '{}'::jsonb,
    constraint user_badges_unique unique (user_id, badge_key),
    constraint user_badges_streak_days_non_negative check (
        streak_days is null or streak_days >= 0
    )
);

create index if not exists idx_user_badges_user_unlocked_at
    on public.user_badges (user_id, unlocked_at desc);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists update_daily_learning_logs_updated_at on public.daily_learning_logs;
create trigger update_daily_learning_logs_updated_at
    before update on public.daily_learning_logs
    for each row
    execute function public.update_updated_at_column();

create or replace function public.get_user_learning_heatmap()
returns table (
    log_date date,
    words_reviewed integer,
    words_correct integer,
    words_incorrect integer,
    new_words_learned integer,
    time_spent_seconds integer,
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
            sum(dll.time_spent_seconds)::integer as time_spent_seconds,
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
        coalesce(aggregated_logs.time_spent_seconds, 0) as time_spent_seconds,
        coalesce(aggregated_logs.session_count, 0) as session_count,
        coalesce(aggregated_logs.activity_count, 0) as activity_count
    from day_series
    left join aggregated_logs
        on aggregated_logs.log_date = day_series.log_date
    order by day_series.log_date asc;
$$;

create or replace function public.recalculate_user_streak(p_user_id uuid)
returns table (
    current_streak integer,
    last_study_date date
)
language plpgsql
as $$
declare
    v_last_study_date date;
    v_current_streak integer := 0;
begin
    with active_days as (
        select dll.log_date
        from public.daily_learning_logs as dll
        where dll.user_id = p_user_id
          and dll.log_date <= current_date
          and (
              dll.words_reviewed > 0
              or dll.words_correct > 0
              or dll.words_incorrect > 0
              or dll.new_words_learned > 0
              or dll.time_spent_seconds > 0
              or dll.session_count > 0
          )
        group by dll.log_date
    )
    select max(active_days.log_date)
    into v_last_study_date
    from active_days;

    if v_last_study_date is not null then
        with recursive streak_days as (
            select v_last_study_date as log_date
            union all
            select (streak_days.log_date - interval '1 day')::date
            from streak_days
            where exists (
                select 1
                from public.daily_learning_logs as dll
                where dll.user_id = p_user_id
                  and dll.log_date = (streak_days.log_date - interval '1 day')::date
                  and (
                      dll.words_reviewed > 0
                      or dll.words_correct > 0
                      or dll.words_incorrect > 0
                      or dll.new_words_learned > 0
                      or dll.time_spent_seconds > 0
                      or dll.session_count > 0
                  )
            )
        )
        select count(*)::integer
        into v_current_streak
        from streak_days;
    end if;

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

insert into public.user_favorites (
    user_id,
    term_id,
    created_at,
    source
)
select
    up.user_id,
    favorite_term.term_id,
    coalesce(up.updated_at, up.created_at, timezone('utc', now())),
    'user_progress_array'
from public.user_progress as up
cross join lateral unnest(coalesce(up.favorites, '{}'::text[])) as favorite_term(term_id)
where coalesce(trim(favorite_term.term_id), '') <> ''
on conflict (user_id, term_id) do nothing;

do $$
begin
    if to_regclass('public.favorites') is not null then
        execute $legacy_favorites$
            insert into public.user_favorites (
                user_id,
                term_id,
                created_at,
                source
            )
            select
                f.user_id,
                f.term_id,
                coalesce(f.created_at, timezone('utc', now())),
                'legacy_favorites'
            from public.favorites as f
            where coalesce(trim(f.term_id), '') <> ''
            on conflict (user_id, term_id) do nothing
        $legacy_favorites$;

        execute $favorites_comment$
            comment on table public.favorites is
            'DEPRECATED: merged into public.user_favorites by 20260306170000_phase1_database_unification_lockdown.sql'
        $favorites_comment$;
    end if;
end;
$$;

comment on column public.user_progress.favorites is
    'DEPRECATED: use public.user_favorites as the single source of truth for favorites.';

do $$
begin
    if to_regclass('public.daily_learning_log') is not null then
        execute $legacy_daily_log$
            insert into public.daily_learning_logs (
                user_id,
                log_date,
                words_reviewed,
                words_correct,
                words_incorrect,
                new_words_learned,
                time_spent_seconds,
                session_count,
                created_at,
                updated_at
            )
            select
                dll.user_id,
                dll.log_date,
                coalesce(dll.words_reviewed, 0),
                coalesce(dll.words_correct, 0),
                coalesce(dll.words_incorrect, 0),
                coalesce(dll.new_words_learned, 0),
                coalesce(dll.time_spent_seconds, 0),
                greatest(coalesce(dll.session_count, 0), 0),
                coalesce(dll.created_at, timezone('utc', now())),
                coalesce(dll.updated_at, timezone('utc', now()))
            from public.daily_learning_log as dll
            on conflict (user_id, log_date) do update
            set
                words_reviewed = public.daily_learning_logs.words_reviewed + excluded.words_reviewed,
                words_correct = public.daily_learning_logs.words_correct + excluded.words_correct,
                words_incorrect = public.daily_learning_logs.words_incorrect + excluded.words_incorrect,
                new_words_learned = public.daily_learning_logs.new_words_learned + excluded.new_words_learned,
                time_spent_seconds = public.daily_learning_logs.time_spent_seconds + excluded.time_spent_seconds,
                session_count = public.daily_learning_logs.session_count + excluded.session_count,
                updated_at = timezone('utc', now())
        $legacy_daily_log$;

        execute $daily_log_comment$
            comment on table public.daily_learning_log is
            'DEPRECATED: merged into public.daily_learning_logs by 20260306170000_phase1_database_unification_lockdown.sql'
        $daily_log_comment$;
    end if;
end;
$$;

do $$
begin
    if to_regclass('public.bot_user_stats') is not null then
        execute $bot_stats_comment$
            comment on table public.bot_user_stats is
            'DEPRECATED: bot-only stats table is superseded by shared quiz/log/favorite tables.'
        $bot_stats_comment$;
    end if;
end;
$$;

create or replace function public.bootstrap_user_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.user_progress (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    insert into public.user_settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_bootstrap on auth.users;
create trigger on_auth_user_created_bootstrap
    after insert on auth.users
    for each row
    execute function public.bootstrap_user_state();

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
        uts.term_id,
        uts.srs_level,
        uts.next_review_date,
        uts.last_reviewed,
        uts.difficulty_score,
        uts.retention_rate,
        uts.times_reviewed,
        uts.times_correct
    from public.user_term_srs as uts
    where uts.user_id = p_shadow_user_id
    on conflict (user_id, term_id) do nothing;

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

create or replace function public.link_telegram_account(
    p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_web_user_id uuid := auth.uid();
    v_telegram_id bigint;
    v_shadow_user_id uuid;
begin
    if v_web_user_id is null then
        raise exception 'Oturum açmadınız. İşlem reddedildi.'
            using errcode = '42501';
    end if;

    select telegram_id
    into v_telegram_id
    from public.account_link_tokens
    where token = p_token
      and expires_at > timezone('utc', now())
    for update;

    if v_telegram_id is null then
        raise exception 'Geçersiz veya süresi dolmuş token.'
            using errcode = '22023';
    end if;

    delete from public.account_link_tokens
    where token = p_token;

    select user_id
    into v_shadow_user_id
    from public.telegram_users
    where telegram_id = v_telegram_id;

    if v_shadow_user_id is not null then
        if v_shadow_user_id = v_web_user_id then
            return jsonb_build_object('success', true, 'message', 'Bu Telegram hesabı zaten profilinize bağlı.');
        end if;

        perform public.merge_shadow_user_state(v_web_user_id, v_shadow_user_id);

        update public.telegram_users
        set user_id = v_web_user_id
        where telegram_id = v_telegram_id;

        delete from auth.users
        where id = v_shadow_user_id;
    else
        insert into public.telegram_users (telegram_id, user_id)
        values (v_telegram_id, v_web_user_id)
        on conflict (telegram_id) do update
        set user_id = excluded.user_id;
    end if;

    return jsonb_build_object(
        'success', true,
        'message', 'Hesap başarıyla birleştirildi!',
        'telegram_id', v_telegram_id
    );
end;
$$;

create or replace function public.link_telegram_account_v2(
    p_token text,
    p_web_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_telegram_id bigint;
    v_shadow_user_id uuid;
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    if p_web_user_id is null then
        raise exception 'Oturum açmadınız. İşlem reddedildi.'
            using errcode = '42501';
    end if;

    select telegram_id
    into v_telegram_id
    from public.account_link_tokens
    where token = p_token
      and expires_at > timezone('utc', now())
    for update;

    if v_telegram_id is null then
        raise exception 'Geçersiz veya süresi dolmuş token.'
            using errcode = '22023';
    end if;

    delete from public.account_link_tokens
    where token = p_token;

    select user_id
    into v_shadow_user_id
    from public.telegram_users
    where telegram_id = v_telegram_id;

    if v_shadow_user_id is not null then
        if v_shadow_user_id = p_web_user_id then
            return jsonb_build_object('success', true, 'message', 'Bu Telegram hesabı zaten profilinize bağlı.', 'telegram_id', v_telegram_id);
        end if;

        perform public.merge_shadow_user_state(p_web_user_id, v_shadow_user_id);

        update public.telegram_users
        set user_id = p_web_user_id
        where telegram_id = v_telegram_id;

        delete from auth.users
        where id = v_shadow_user_id;
    else
        insert into public.telegram_users (telegram_id, user_id)
        values (v_telegram_id, p_web_user_id)
        on conflict (telegram_id) do update
        set user_id = excluded.user_id;
    end if;

    return jsonb_build_object('success', true, 'message', 'Hesap başarıyla birleştirildi!', 'telegram_id', v_telegram_id);
end;
$$;

create or replace function public.log_daily_learning(
    p_user_id uuid,
    p_words_reviewed integer default 0,
    p_words_correct integer default 0,
    p_words_incorrect integer default 0,
    p_new_words_learned integer default 0
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    if p_user_id is null then
        raise exception 'User is required.'
            using errcode = '22023';
    end if;

    insert into public.daily_learning_logs (
        user_id,
        log_date,
        words_reviewed,
        words_correct,
        words_incorrect,
        new_words_learned,
        session_count
    )
    values (
        p_user_id,
        current_date,
        greatest(coalesce(p_words_reviewed, 0), 0),
        greatest(coalesce(p_words_correct, 0), 0),
        greatest(coalesce(p_words_incorrect, 0), 0),
        greatest(coalesce(p_new_words_learned, 0), 0),
        1
    )
    on conflict (user_id, log_date) do update
    set
        words_reviewed = public.daily_learning_logs.words_reviewed + excluded.words_reviewed,
        words_correct = public.daily_learning_logs.words_correct + excluded.words_correct,
        words_incorrect = public.daily_learning_logs.words_incorrect + excluded.words_incorrect,
        new_words_learned = public.daily_learning_logs.new_words_learned + excluded.new_words_learned,
        session_count = public.daily_learning_logs.session_count + excluded.session_count,
        updated_at = timezone('utc', now());

    perform public.recalculate_user_streak(p_user_id);
end;
$$;

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
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_user_id uuid;
    v_log public.daily_learning_logs;
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

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
        v_user_id,
        coalesce(p_log_date, current_date),
        greatest(coalesce(p_words_reviewed, 0), 0),
        greatest(coalesce(p_words_correct, 0), 0),
        greatest(coalesce(p_words_incorrect, 0), 0),
        greatest(coalesce(p_new_words_learned, 0), 0),
        greatest(coalesce(p_time_spent_seconds, 0), 0),
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
        updated_at = timezone('utc', now())
    returning * into v_log;

    perform public.recalculate_user_streak(v_user_id);

    return v_log;
end;
$$;

create or replace function public.record_study_event(
    p_user_id uuid,
    p_term_id text,
    p_is_correct boolean,
    p_response_time_ms integer default 0,
    p_quiz_type text default 'daily',
    p_log_date date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
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
    v_progress public.user_progress%rowtype;
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    if p_user_id is null or coalesce(trim(p_term_id), '') = '' then
        raise exception 'User and term are required.'
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

    if not exists (
        select 1
        from public.user_favorites
        where user_id = p_user_id
          and term_id = p_term_id
    ) then
        raise exception 'Term must be favorited before review.'
            using errcode = '23514';
    end if;

    insert into public.user_progress (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

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

    insert into public.quiz_attempts (
        user_id,
        term_id,
        is_correct,
        response_time_ms,
        quiz_type,
        created_at
    )
    values (
        p_user_id,
        p_term_id,
        p_is_correct,
        greatest(coalesce(p_response_time_ms, 0), 0),
        p_quiz_type,
        timezone('utc', now())
    );

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

    select *
    into v_progress
    from public.user_progress
    where user_id = p_user_id;

    return jsonb_build_object(
        'userProgress', jsonb_build_object(
            'current_streak', coalesce(v_progress.current_streak, 0),
            'last_study_date', v_progress.last_study_date,
            'total_words_learned', coalesce(v_progress.total_words_learned, 0),
            'updated_at', v_progress.updated_at
        ),
        'termSrs', jsonb_build_object(
            'term_id', p_term_id,
            'srs_level', v_new_level,
            'next_review_date', v_next_review_date,
            'last_reviewed', v_last_reviewed,
            'difficulty_score', round(v_new_difficulty::numeric, 2),
            'retention_rate', round(v_new_retention::numeric, 2),
            'times_reviewed', v_times_reviewed,
            'times_correct', v_times_correct
        )
    );
end;
$$;

alter table public.user_favorites enable row level security;

drop policy if exists "Users can view own favorites" on public.user_favorites;
create policy "Users can view own favorites"
    on public.user_favorites
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Service role can manage user favorites" on public.user_favorites;
create policy "Service role can manage user favorites"
    on public.user_favorites
    for all
    to service_role
    using (true)
    with check (true);

drop policy if exists "Users can insert own progress" on public.user_progress;
drop policy if exists "Users can update own progress" on public.user_progress;
drop policy if exists "Users can insert own quiz attempts" on public.quiz_attempts;
drop policy if exists "Users can insert own SRS data" on public.user_term_srs;
drop policy if exists "Users can update own SRS data" on public.user_term_srs;
drop policy if exists "Users can insert own daily learning logs" on public.daily_learning_logs;
drop policy if exists "Users can update own daily learning logs" on public.daily_learning_logs;
drop policy if exists "Users can delete own daily learning logs" on public.daily_learning_logs;
drop policy if exists "Users can insert own badges" on public.user_badges;

do $$
begin
    if to_regclass('public.user_achievements') is not null then
        execute 'drop policy if exists "Users can insert own achievements" on public.user_achievements';
    end if;
end;
$$;

do $$
begin
    if to_regclass('public.daily_learning_log') is not null then
        execute 'alter table public.daily_learning_log enable row level security';
        execute 'drop policy if exists "Users can insert own daily logs" on public.daily_learning_log';
        execute 'drop policy if exists "Users can update own daily logs" on public.daily_learning_log';
        execute 'drop policy if exists "Users can delete own daily logs" on public.daily_learning_log';
        execute 'drop policy if exists "Users can view own daily logs" on public.daily_learning_log';
        execute $policy$
            create policy "Users can view own daily logs"
                on public.daily_learning_log
                for select
                to authenticated
                using (auth.uid() = user_id)
        $policy$;
        execute 'revoke all on public.daily_learning_log from anon, authenticated';
        execute 'grant select on public.daily_learning_log to authenticated';
    end if;
end;
$$;

do $$
begin
    if to_regclass('public.favorites') is not null then
        execute 'alter table public.favorites enable row level security';
        execute 'drop policy if exists "Users can view own favorites" on public.favorites';
        execute 'drop policy if exists "Users can insert own favorites" on public.favorites';
        execute 'drop policy if exists "Users can update own favorites" on public.favorites';
        execute 'drop policy if exists "Users can delete own favorites" on public.favorites';
        execute $policy$
            create policy "Users can view own favorites"
                on public.favorites
                for select
                to authenticated
                using (auth.uid() = user_id)
        $policy$;
        execute 'revoke all on public.favorites from anon, authenticated';
        execute 'grant select on public.favorites to authenticated';
    end if;
end;
$$;

do $$
begin
    if to_regclass('public.bot_user_stats') is not null then
        execute 'alter table public.bot_user_stats enable row level security';
        execute 'drop policy if exists "Bot full access" on public.bot_user_stats';
        execute 'revoke all on public.bot_user_stats from public, anon, authenticated';
    end if;
end;
$$;

do $$
begin
    if to_regclass('public.study_sessions') is not null then
        execute 'alter table public.study_sessions enable row level security';
        execute 'drop policy if exists "Users can view own sessions" on public.study_sessions';
        execute 'drop policy if exists "Anyone can insert sessions" on public.study_sessions';
        execute 'drop policy if exists "Users can update own sessions" on public.study_sessions';
        execute 'drop policy if exists "Service role can manage study sessions" on public.study_sessions';
        execute $policy$
            create policy "Users can view own sessions"
                on public.study_sessions
                for select
                to authenticated
                using (auth.uid() = user_id)
        $policy$;
        execute $policy$
            create policy "Service role can manage study sessions"
                on public.study_sessions
                for all
                to service_role
                using (true)
                with check (true)
        $policy$;
        execute 'revoke all on public.study_sessions from anon, authenticated';
        execute 'grant select on public.study_sessions to authenticated';
    end if;
end;
$$;

revoke all on public.user_favorites from anon, authenticated;
revoke all on public.user_progress from anon, authenticated;
revoke all on public.quiz_attempts from anon, authenticated;
revoke all on public.user_term_srs from anon, authenticated;
revoke all on public.daily_learning_logs from anon, authenticated;
revoke all on public.user_badges from anon, authenticated;

grant select on public.user_favorites to authenticated;
grant select on public.user_progress to authenticated;
grant select on public.quiz_attempts to authenticated;
grant select on public.user_term_srs to authenticated;
grant select on public.daily_learning_logs to authenticated;
grant select on public.user_badges to authenticated;

do $$
begin
    if to_regclass('public.user_achievements') is not null then
        execute 'revoke all on public.user_achievements from anon, authenticated';
        execute 'grant select on public.user_achievements to authenticated';
    end if;
end;
$$;

revoke all on function public.log_daily_learning(uuid, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.log_daily_learning(uuid, integer, integer, integer, integer) to service_role;

revoke all on function public.increment_daily_learning_log(date, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.increment_daily_learning_log(date, integer, integer, integer, integer, integer) to service_role;

revoke all on function public.link_telegram_account(text) from public, anon, authenticated;
grant execute on function public.link_telegram_account(text) to service_role;

revoke all on function public.link_telegram_account_v2(text, uuid) from public, anon, authenticated;
grant execute on function public.link_telegram_account_v2(text, uuid) to service_role;

revoke all on function public.generate_telegram_link_token(bigint) from public, anon, authenticated;
grant execute on function public.generate_telegram_link_token(bigint) to service_role;

revoke all on function public.sync_telegram_user(bigint, text, text) from public, anon, authenticated;
grant execute on function public.sync_telegram_user(bigint, text, text) to service_role;

revoke all on function public.merge_shadow_user_state(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_shadow_user_state(uuid, uuid) to service_role;

revoke all on function public.record_study_event(uuid, text, boolean, integer, text, date) from public, anon, authenticated;
grant execute on function public.record_study_event(uuid, text, boolean, integer, text, date) to service_role;

revoke all on function public.recalculate_user_streak(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_user_streak(uuid) to service_role;

grant execute on function public.get_user_learning_heatmap() to authenticated;
