create or replace function public.record_my_study_event(
    p_term_id text,
    p_is_correct boolean,
    p_response_time_ms integer default 0,
    p_quiz_type text default 'daily',
    p_log_date date default null,
    p_idempotency_key text default null,
    p_session_id uuid default null,
    p_session_token_hash text default null,
    p_occurred_at timestamptz default null
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

    if not public.is_profile_member_complete(v_user_id) then
        raise exception 'Complete your member setup to unlock review mode.'
            using errcode = '42501';
    end if;

    return public.record_study_event(
        v_user_id,
        p_term_id,
        p_is_correct,
        p_response_time_ms,
        p_quiz_type,
        p_log_date,
        p_idempotency_key,
        p_session_id,
        p_session_token_hash,
        p_occurred_at
    );
end;
$$;

revoke all on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz) from public, anon;
grant execute on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz) to authenticated;
