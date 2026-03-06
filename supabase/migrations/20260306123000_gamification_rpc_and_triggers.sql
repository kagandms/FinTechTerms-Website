create extension if not exists "uuid-ossp";

create table if not exists public.daily_learning_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users (id) on delete cascade,
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
    user_id uuid not null references auth.users (id) on delete cascade,
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
                words_reviewed = excluded.words_reviewed,
                words_correct = excluded.words_correct,
                words_incorrect = excluded.words_incorrect,
                new_words_learned = excluded.new_words_learned,
                time_spent_seconds = excluded.time_spent_seconds,
                session_count = excluded.session_count,
                updated_at = excluded.updated_at
        $legacy_daily_log$;
    end if;
end;
$$;

do $$
begin
    if to_regclass('public.user_achievements') is not null then
        execute $legacy_user_achievements$
            insert into public.user_badges (
                user_id,
                badge_key,
                badge_type,
                streak_days,
                unlocked_at,
                metadata
            )
            select
                ua.user_id,
                case ua.achievement_type
                    when '3_day_streak' then 'streak_3'
                    when '7_day_streak' then 'streak_7'
                    when '30_day_streak' then 'streak_30'
                    else ua.achievement_type
                end,
                'streak',
                case ua.achievement_type
                    when '3_day_streak' then 3
                    when '7_day_streak' then 7
                    when '30_day_streak' then 30
                    else null
                end,
                coalesce(ua.earned_at, timezone('utc', now())),
                jsonb_build_object('legacy_source', 'user_achievements')
            from public.user_achievements as ua
            on conflict (user_id, badge_key) do nothing
        $legacy_user_achievements$;
    end if;
end;
$$;

alter table public.daily_learning_logs enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists "Users can view own daily learning logs" on public.daily_learning_logs;
create policy "Users can view own daily learning logs"
    on public.daily_learning_logs
    for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily learning logs" on public.daily_learning_logs;
create policy "Users can insert own daily learning logs"
    on public.daily_learning_logs
    for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily learning logs" on public.daily_learning_logs;
create policy "Users can update own daily learning logs"
    on public.daily_learning_logs
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete own daily learning logs" on public.daily_learning_logs;
create policy "Users can delete own daily learning logs"
    on public.daily_learning_logs
    for delete
    using (auth.uid() = user_id);

drop policy if exists "Users can view own badges" on public.user_badges;
create policy "Users can view own badges"
    on public.user_badges
    for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own badges" on public.user_badges;
create policy "Users can insert own badges"
    on public.user_badges
    for insert
    with check (auth.uid() = user_id);

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
        session_count = greatest(public.daily_learning_logs.session_count, 1),
        updated_at = timezone('utc', now())
    returning * into v_log;

    return v_log;
end;
$$;

grant execute on function public.increment_daily_learning_log(date, integer, integer, integer, integer, integer) to authenticated;

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

create or replace function public.handle_daily_learning_log_badges()
returns trigger
language plpgsql
as $$
declare
    v_user_id uuid := coalesce(new.user_id, old.user_id);
    v_current_streak integer := 0;
    v_last_study_date date;
begin
    select streak.current_streak, streak.last_study_date
    into v_current_streak, v_last_study_date
    from public.recalculate_user_streak(v_user_id) as streak;

    if tg_op <> 'DELETE' then
        if v_current_streak >= 3 then
            insert into public.user_badges (
                user_id,
                badge_key,
                badge_type,
                streak_days,
                unlocked_at,
                source_log_date,
                metadata
            )
            values (
                v_user_id,
                'streak_3',
                'streak',
                3,
                timezone('utc', now()),
                coalesce(new.log_date, v_last_study_date),
                jsonb_build_object('milestone', 3)
            )
            on conflict (user_id, badge_key) do nothing;
        end if;

        if v_current_streak >= 7 then
            insert into public.user_badges (
                user_id,
                badge_key,
                badge_type,
                streak_days,
                unlocked_at,
                source_log_date,
                metadata
            )
            values (
                v_user_id,
                'streak_7',
                'streak',
                7,
                timezone('utc', now()),
                coalesce(new.log_date, v_last_study_date),
                jsonb_build_object('milestone', 7)
            )
            on conflict (user_id, badge_key) do nothing;
        end if;

        if v_current_streak >= 30 then
            insert into public.user_badges (
                user_id,
                badge_key,
                badge_type,
                streak_days,
                unlocked_at,
                source_log_date,
                metadata
            )
            values (
                v_user_id,
                'streak_30',
                'streak',
                30,
                timezone('utc', now()),
                coalesce(new.log_date, v_last_study_date),
                jsonb_build_object('milestone', 30)
            )
            on conflict (user_id, badge_key) do nothing;
        end if;
    end if;

    return coalesce(new, old);
end;
$$;

drop trigger if exists trigger_daily_learning_log_badges on public.daily_learning_logs;
create trigger trigger_daily_learning_log_badges
    after insert or update or delete on public.daily_learning_logs
    for each row
    execute function public.handle_daily_learning_log_badges();

do $$
begin
    if to_regclass('public.daily_learning_log') is not null then
        execute 'drop trigger if exists trigger_legacy_daily_learning_log_badges on public.daily_learning_log';
        execute '
            create trigger trigger_legacy_daily_learning_log_badges
            after insert or update or delete on public.daily_learning_log
            for each row
            execute function public.handle_daily_learning_log_badges()
        ';
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'user_badges'
    ) then
        alter publication supabase_realtime add table public.user_badges;
    end if;
exception
    when undefined_object then
        null;
end;
$$;
