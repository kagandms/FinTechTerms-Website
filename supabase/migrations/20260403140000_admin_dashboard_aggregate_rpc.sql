create or replace function public.get_admin_simulation_learning_curve()
returns table (
    date date,
    accuracy double precision
)
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

    return query
    select
        (timezone('utc', qa.created_at))::date as date,
        avg(case when qa.is_correct then 100 else 0 end)::double precision as accuracy
    from public.quiz_attempts as qa
    where qa.quiz_type = 'simulation'
      and qa.created_at is not null
    group by (timezone('utc', qa.created_at))::date
    order by date asc;
end;
$$;

revoke all on function public.get_admin_simulation_learning_curve() from public, anon, authenticated;
grant execute on function public.get_admin_simulation_learning_curve() to service_role;

create or replace function public.get_admin_simulation_latency_summary()
returns table (
    name text,
    ms integer
)
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

    return query
    with aggregates as (
        select
            case when qa.is_correct then 'Correct'::text else 'Incorrect'::text end as name,
            round(avg(greatest(coalesce(qa.response_time_ms, 0), 0))::numeric)::integer as ms
        from public.quiz_attempts as qa
        where qa.quiz_type = 'simulation'
        group by 1
    )
    select
        labels.name,
        coalesce(aggregates.ms, 0) as ms
    from (values ('Correct'::text), ('Incorrect'::text)) as labels(name)
    left join aggregates
        on aggregates.name = labels.name
    order by case when labels.name = 'Correct' then 0 else 1 end;
end;
$$;

revoke all on function public.get_admin_simulation_latency_summary() from public, anon, authenticated;
grant execute on function public.get_admin_simulation_latency_summary() to service_role;

create or replace function public.get_admin_simulation_fatigue_curve()
returns table (
    "order" integer,
    "errorRate" double precision
)
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

    return query
    with ordered_attempts as (
        select
            row_number() over (
                partition by qa.session_id
                order by qa.created_at asc, qa.id asc
            )::integer as order_idx,
            qa.is_correct
        from public.quiz_attempts as qa
        where qa.quiz_type = 'simulation'
          and qa.session_id is not null
          and qa.created_at is not null
    )
    select
        ordered_attempts.order_idx as "order",
        (
            count(*) filter (where not ordered_attempts.is_correct)::double precision
            / count(*)::double precision
        ) * 100 as "errorRate"
    from ordered_attempts
    where ordered_attempts.order_idx <= 25
    group by ordered_attempts.order_idx
    order by "order" asc;
end;
$$;

revoke all on function public.get_admin_simulation_fatigue_curve() from public, anon, authenticated;
grant execute on function public.get_admin_simulation_fatigue_curve() to service_role;

create or replace function public.get_admin_simulation_accuracy_distribution()
returns table (
    range text,
    count integer
)
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

    return query
    with per_user_accuracy as (
        select
            qa.user_id,
            (
                count(*) filter (where qa.is_correct)::double precision
                / count(*)::double precision
            ) * 100 as accuracy
        from public.quiz_attempts as qa
        where qa.quiz_type = 'simulation'
          and qa.user_id is not null
        group by qa.user_id
    ),
    bucketed as (
        select
            case
                when per_user_accuracy.accuracy = 100 then 100
                else floor(per_user_accuracy.accuracy / 5)::integer * 5
            end as bucket_start
        from per_user_accuracy
    )
    select
        case
            when bucketed.bucket_start = 100 then '100%'::text
            else format('%s-%s%%', bucketed.bucket_start, bucketed.bucket_start + 5)
        end as range,
        count(*)::integer as count
    from bucketed
    group by bucketed.bucket_start
    order by bucketed.bucket_start asc;
end;
$$;

revoke all on function public.get_admin_simulation_accuracy_distribution() from public, anon, authenticated;
grant execute on function public.get_admin_simulation_accuracy_distribution() to service_role;
