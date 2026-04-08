create or replace function public.is_profile_member_complete(
    p_user_id uuid default auth.uid()
) returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_birth_date date;
    v_today date := timezone('utc', now())::date;
begin
    if p_user_id is null then
        return false;
    end if;

    select birth_date
    into v_birth_date
    from public.profiles
    where id = p_user_id;

    if v_birth_date is null then
        return false;
    end if;

    if v_birth_date > v_today then
        return false;
    end if;

    if v_birth_date > (v_today - interval '13 years')::date then
        return false;
    end if;

    if v_birth_date < (v_today - interval '120 years')::date then
        return false;
    end if;

    return true;
end;
$$;

revoke all on function public.is_profile_member_complete(uuid) from public, anon;
grant execute on function public.is_profile_member_complete(uuid) to authenticated, service_role;

create or replace function public.get_user_favorite_limit(
    p_user_id uuid default auth.uid()
) returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    if public.is_profile_member_complete(p_user_id) then
        return 2147483647;
    end if;

    return 15;
end;
$$;

revoke all on function public.get_user_favorite_limit(uuid) from public, anon;
grant execute on function public.get_user_favorite_limit(uuid) to authenticated, service_role;

create or replace function public.toggle_my_favorite(
    p_term_id text,
    p_should_favorite boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_is_already_favorite boolean := false;
    v_favorite_limit integer;
    v_favorite_count integer;
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    insert into public.user_progress (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    perform 1
    from public.user_progress
    where user_id = v_user_id
    for update;

    if p_should_favorite then
        select exists (
            select 1
            from public.user_favorites
            where user_id = v_user_id
              and term_id = p_term_id
        )
        into v_is_already_favorite;

        if not v_is_already_favorite then
            v_favorite_limit := public.get_user_favorite_limit(v_user_id);

            select count(*)
            into v_favorite_count
            from public.user_favorites
            where user_id = v_user_id;

            if v_favorite_count >= v_favorite_limit then
                raise exception 'Favorite limit reached.'
                    using errcode = '23514';
            end if;
        end if;
    end if;

    return public.toggle_user_favorite(v_user_id, p_term_id, p_should_favorite);
end;
$$;

revoke all on function public.toggle_my_favorite(text, boolean) from public, anon;
grant execute on function public.toggle_my_favorite(text, boolean) to authenticated;

create or replace function public.record_my_study_event(
    p_term_id text,
    p_is_correct boolean,
    p_response_time_ms integer default 0,
    p_quiz_type text default 'daily',
    p_log_date date default null,
    p_idempotency_key text default null,
    p_session_id uuid default null,
    p_session_token_hash text default null
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

    return public.record_study_event(
        v_user_id,
        p_term_id,
        p_is_correct,
        p_response_time_ms,
        p_quiz_type,
        p_log_date,
        p_idempotency_key,
        p_session_id,
        p_session_token_hash
    );
end;
$$;

revoke all on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text) from public, anon;
grant execute on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text) to authenticated;

revoke all on function public.start_study_session(text, text, text, boolean, text, uuid, text) from public;
grant execute on function public.start_study_session(text, text, text, boolean, text, uuid, text) to anon, authenticated;

revoke all on function public.bind_study_session_token(uuid, text, text, text) from public;
grant execute on function public.bind_study_session_token(uuid, text, text, text) to anon, authenticated;

revoke all on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) from public;
grant execute on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) to anon, authenticated;

drop policy if exists "Authenticated users can manage own api idempotency keys" on public.api_idempotency_keys;
create policy "Authenticated users can manage own api idempotency keys"
    on public.api_idempotency_keys
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

revoke all on public.api_idempotency_keys from public, anon, authenticated;
grant select, insert, update, delete on public.api_idempotency_keys to authenticated;

create or replace function public.get_public_term_category_counts()
returns table (
    category text,
    count bigint
)
language sql
security definer
stable
set search_path = public
as $$
    select
        terms.category,
        count(*)::bigint as count
    from public.terms as terms
    where terms.is_academic is distinct from false
    group by terms.category
    order by terms.category asc;
$$;

revoke all on function public.get_public_term_category_counts() from public;
grant execute on function public.get_public_term_category_counts() to anon, authenticated, service_role;
