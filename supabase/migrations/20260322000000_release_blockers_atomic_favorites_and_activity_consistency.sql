create or replace function public.toggle_user_favorite(
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
    v_favorites jsonb;
    v_is_favorite boolean;
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    if p_user_id is null or coalesce(trim(p_term_id), '') = '' then
        raise exception 'User and term are required.'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from public.terms
        where id = p_term_id
    ) then
        raise exception 'Term not found.'
            using errcode = 'P0002';
    end if;

    if p_should_favorite then
        insert into public.user_favorites (
            user_id,
            term_id,
            source
        )
        values (
            p_user_id,
            p_term_id,
            'web'
        )
        on conflict (user_id, term_id) do nothing;
    else
        delete from public.user_favorites
        where user_id = p_user_id
          and term_id = p_term_id;
    end if;

    select exists (
        select 1
        from public.user_favorites
        where user_id = p_user_id
          and term_id = p_term_id
    )
    into v_is_favorite;

    select coalesce(
        jsonb_agg(uf.term_id order by uf.created_at desc),
        '[]'::jsonb
    )
    into v_favorites
    from public.user_favorites as uf
    where uf.user_id = p_user_id;

    return jsonb_build_object(
        'success', true,
        'termId', p_term_id,
        'isFavorite', v_is_favorite,
        'favorites', v_favorites
    );
end;
$$;

revoke all on function public.toggle_user_favorite(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.toggle_user_favorite(uuid, text, boolean) to service_role;

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
    v_time_spent_ms bigint := greatest(coalesce(p_time_spent_seconds, 0), 0)::bigint * 1000;
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
        time_spent_ms,
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
        v_time_spent_ms,
        1
    )
    on conflict (user_id, log_date) do update
    set
        words_reviewed = public.daily_learning_logs.words_reviewed + excluded.words_reviewed,
        words_correct = public.daily_learning_logs.words_correct + excluded.words_correct,
        words_incorrect = public.daily_learning_logs.words_incorrect + excluded.words_incorrect,
        new_words_learned = public.daily_learning_logs.new_words_learned + excluded.new_words_learned,
        time_spent_seconds = public.daily_learning_logs.time_spent_seconds + excluded.time_spent_seconds,
        time_spent_ms = public.daily_learning_logs.time_spent_ms + excluded.time_spent_ms,
        session_count = public.daily_learning_logs.session_count + excluded.session_count,
        updated_at = timezone('utc', now())
    returning * into v_log;

    return v_log;
end;
$$;

revoke all on function public.increment_daily_learning_log(date, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.increment_daily_learning_log(date, integer, integer, integer, integer, integer) to authenticated;
