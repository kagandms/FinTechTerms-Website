create or replace function public.is_profile_member_complete(
    p_user_id uuid default auth.uid()
) returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_caller_user_id uuid := auth.uid();
    v_target_user_id uuid := coalesce(p_user_id, v_caller_user_id);
    v_birth_date date;
    v_today date := timezone('utc', now())::date;
begin
    if v_target_user_id is null then
        return false;
    end if;

    if v_request_role <> 'service_role'
       and v_caller_user_id is distinct from v_target_user_id then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    select birth_date
    into v_birth_date
    from public.profiles
    where id = v_target_user_id;

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

create or replace function public.get_user_favorite_limit(
    p_user_id uuid default auth.uid()
) returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_caller_user_id uuid := auth.uid();
    v_target_user_id uuid := coalesce(p_user_id, v_caller_user_id);
begin
    if v_target_user_id is null then
        return 15;
    end if;

    if v_request_role <> 'service_role'
       and v_caller_user_id is distinct from v_target_user_id then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    if public.is_profile_member_complete(v_target_user_id) then
        return 2147483647;
    end if;

    return 15;
end;
$$;
