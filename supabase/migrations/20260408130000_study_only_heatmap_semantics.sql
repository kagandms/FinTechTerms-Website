create index if not exists idx_study_sessions_user_session_start_desc
    on public.study_sessions (user_id, session_start desc)
    where user_id is not null
      and session_start is not null;

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
        coalesce(aggregated_logs.words_reviewed, 0)::integer as activity_count
    from day_series
    left join aggregated_logs
        on aggregated_logs.log_date = day_series.log_date
    left join aggregated_sessions
        on aggregated_sessions.log_date = day_series.log_date
    order by day_series.log_date asc;
$$;
