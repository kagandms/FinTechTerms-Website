create or replace function public.toggle_my_favorite_server(
    p_user_id uuid,
    p_term_id text,
    p_should_favorite boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_is_already_favorite boolean := false;
    v_favorite_limit integer;
    v_favorite_count integer;
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    if p_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    insert into public.user_progress (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    perform 1
    from public.user_progress
    where user_id = p_user_id
    for update;

    if p_should_favorite then
        select exists (
            select 1
            from public.user_favorites
            where user_id = p_user_id
              and term_id = p_term_id
        )
        into v_is_already_favorite;

        if not v_is_already_favorite then
            v_favorite_limit := public.get_user_favorite_limit(p_user_id);

            select count(*)
            into v_favorite_count
            from public.user_favorites
            where user_id = p_user_id;

            if v_favorite_count >= v_favorite_limit then
                raise exception 'Favorite limit reached.'
                    using errcode = '23514';
            end if;
        end if;
    end if;

    return public.toggle_user_favorite(p_user_id, p_term_id, p_should_favorite);
end;
$$;

revoke all on function public.toggle_my_favorite_server(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.toggle_my_favorite_server(uuid, text, boolean) to service_role;
