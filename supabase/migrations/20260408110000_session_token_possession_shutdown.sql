create or replace function public.update_study_session_by_token_server(
    p_requester_user_id uuid,
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
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_session public.study_sessions%rowtype;
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
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

    if coalesce(trim(p_session_token_hash), '') = ''
       or v_session.session_token_hash is distinct from p_session_token_hash then
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
