revoke all on function public.toggle_my_favorite(text, boolean) from public, anon, authenticated;
revoke all on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text) from public, anon, authenticated;
revoke all on function public.start_study_session(text, text, text, boolean, text, uuid, text) from public, anon, authenticated;
revoke all on function public.bind_study_session_token(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) from public, anon, authenticated;

drop policy if exists "Authenticated users can manage own api idempotency keys" on public.api_idempotency_keys;
revoke all on public.api_idempotency_keys from authenticated;

create or replace function public.start_study_session_server(
    p_requester_user_id uuid,
    p_requester_anonymous_id text,
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
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_requester_anonymous_id text := nullif(trim(p_requester_anonymous_id), '');
    v_existing_session public.study_sessions%rowtype;
    v_session_id uuid;
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

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

    if p_requester_user_id is null and v_requester_anonymous_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    if p_requester_user_id is not null and p_previous_session_id is not null then
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
           and v_existing_session.user_id <> p_requester_user_id then
            raise exception 'Previous study session does not belong to this requester.'
                using errcode = '42501';
        end if;

        update public.study_sessions
        set user_id = p_requester_user_id
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
            p_requester_user_id,
            case
                when p_requester_user_id is null then v_requester_anonymous_id
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
            if p_requester_user_id is not null then
                select id
                into v_session_id
                from public.study_sessions
                where user_id = p_requester_user_id
                  and idempotency_key = p_idempotency_key
                limit 1;
            else
                select id
                into v_session_id
                from public.study_sessions
                where anonymous_id = v_requester_anonymous_id
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

revoke all on function public.start_study_session_server(uuid, text, text, text, boolean, text, uuid, text) from public, anon, authenticated;
grant execute on function public.start_study_session_server(uuid, text, text, text, boolean, text, uuid, text) to service_role;

create or replace function public.bind_study_session_token_server(
    p_requester_user_id uuid,
    p_requester_anonymous_id text,
    p_session_id uuid,
    p_idempotency_key text,
    p_session_token_hash text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_requester_anonymous_id text := nullif(trim(p_requester_anonymous_id), '');
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

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
          (p_requester_user_id is not null and user_id = p_requester_user_id)
          or (
              p_requester_user_id is null
              and user_id is null
              and anonymous_id = v_requester_anonymous_id
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

revoke all on function public.bind_study_session_token_server(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bind_study_session_token_server(uuid, text, uuid, text, text) to service_role;

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

    if v_session.user_id is not null
       and p_requester_user_id is distinct from v_session.user_id then
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

revoke all on function public.update_study_session_by_token_server(uuid, uuid, text, integer, integer, integer, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.update_study_session_by_token_server(uuid, uuid, text, integer, integer, integer, boolean, timestamptz) to service_role;
