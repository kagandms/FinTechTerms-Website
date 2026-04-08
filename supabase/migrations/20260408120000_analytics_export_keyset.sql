create or replace function public.get_user_quiz_attempt_export_page(
    p_snapshot_created_at timestamptz default timezone('utc', now()),
    p_last_created_at timestamptz default null,
    p_last_id uuid default null,
    p_limit integer default 500
) returns table (
    id uuid,
    term_id text,
    is_correct boolean,
    response_time_ms integer,
    created_at timestamptz,
    quiz_type text
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    if (p_last_created_at is null) <> (p_last_id is null) then
        raise exception 'Cursor timestamp and id must be provided together.'
            using errcode = '22023';
    end if;

    return query
    select
        qa.id,
        qa.term_id,
        qa.is_correct,
        qa.response_time_ms,
        qa.created_at,
        qa.quiz_type
    from public.quiz_attempts as qa
    where qa.user_id = auth.uid()
      and qa.created_at <= p_snapshot_created_at
      and (
          p_last_created_at is null
          or qa.created_at < p_last_created_at
          or (
              qa.created_at = p_last_created_at
              and qa.id < p_last_id
          )
      )
    order by qa.created_at desc, qa.id desc
    limit greatest(1, least(coalesce(p_limit, 500), 1001));
end;
$$;

revoke all on function public.get_user_quiz_attempt_export_page(timestamptz, timestamptz, uuid, integer) from public, anon;
grant execute on function public.get_user_quiz_attempt_export_page(timestamptz, timestamptz, uuid, integer) to authenticated, service_role;
