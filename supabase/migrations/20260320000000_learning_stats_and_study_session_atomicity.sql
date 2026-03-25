create or replace function public.get_user_quiz_metrics(
    p_user_id uuid default auth.uid()
) returns table (
    total_reviews bigint,
    correct_reviews bigint,
    avg_response_time_ms integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_target_user_id uuid := coalesce(p_user_id, auth.uid());
begin
    if v_target_user_id is null then
        return query
        select 0::bigint, 0::bigint, null::integer;
        return;
    end if;

    if v_request_role <> 'service_role'
       and auth.uid() is distinct from v_target_user_id then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    return query
    select
        count(*)::bigint as total_reviews,
        count(*) filter (where qa.is_correct)::bigint as correct_reviews,
        case
            when count(*) = 0 then null::integer
            else round(avg(greatest(coalesce(qa.response_time_ms, 0), 0))::numeric)::integer
        end as avg_response_time_ms
    from public.quiz_attempts as qa
    where qa.user_id = v_target_user_id;
end;
$$;

revoke all on function public.get_user_quiz_metrics(uuid) from public, anon, authenticated;
grant execute on function public.get_user_quiz_metrics(uuid) to authenticated, service_role;

create or replace function public.update_study_session_metrics(
    p_session_id uuid,
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
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
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

    if not found then
        raise exception 'Study session not found.'
            using errcode = 'P0002';
    end if;
end;
$$;

revoke all on function public.update_study_session_metrics(uuid, integer, integer, integer, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.update_study_session_metrics(uuid, integer, integer, integer, boolean, timestamptz) to service_role;
