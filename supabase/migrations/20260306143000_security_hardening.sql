alter table public.telegram_users enable row level security;

drop policy if exists "Service Role can manage telegram_users" on public.telegram_users;
drop policy if exists "Service role can manage telegram_users" on public.telegram_users;
drop policy if exists "Authenticated users can read own telegram mapping" on public.telegram_users;
drop policy if exists "Authenticated users can update own telegram mapping" on public.telegram_users;

create policy "Service role can manage telegram_users"
    on public.telegram_users
    for all
    to service_role
    using (true)
    with check (true);

create policy "Authenticated users can read own telegram mapping"
    on public.telegram_users
    for select
    to authenticated
    using (auth.uid() = user_id);

create policy "Authenticated users can update own telegram mapping"
    on public.telegram_users
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

alter table public.account_link_tokens enable row level security;

drop policy if exists "Service role can manage account_link_tokens" on public.account_link_tokens;
create policy "Service role can manage account_link_tokens"
    on public.account_link_tokens
    for all
    to service_role
    using (true)
    with check (true);

create table if not exists public.account_link_token_failures (
    id bigint generated always as identity primary key,
    web_user_id uuid not null references auth.users(id) on delete cascade,
    attempted_token_hash text not null,
    attempted_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_account_link_token_failures_user_attempted_at
    on public.account_link_token_failures (web_user_id, attempted_at desc);

create table if not exists public.account_link_token_lockouts (
    web_user_id uuid primary key references auth.users(id) on delete cascade,
    locked_until timestamptz not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_account_link_token_lockouts_locked_until
    on public.account_link_token_lockouts (locked_until desc);

alter table public.account_link_token_failures enable row level security;
alter table public.account_link_token_lockouts enable row level security;

drop policy if exists "Service role can manage account_link_token_failures" on public.account_link_token_failures;
create policy "Service role can manage account_link_token_failures"
    on public.account_link_token_failures
    for all
    to service_role
    using (true)
    with check (true);

drop policy if exists "Service role can manage account_link_token_lockouts" on public.account_link_token_lockouts;
create policy "Service role can manage account_link_token_lockouts"
    on public.account_link_token_lockouts
    for all
    to service_role
    using (true)
    with check (true);

create or replace function public.handle_account_link_token_failure()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_failed_attempts integer;
begin
    delete from public.account_link_token_failures
    where attempted_at < timezone('utc', now()) - interval '1 day';

    select count(*)
    into v_failed_attempts
    from public.account_link_token_failures
    where web_user_id = new.web_user_id
      and attempted_at >= timezone('utc', now()) - interval '10 minutes';

    if v_failed_attempts >= 5 then
        insert into public.account_link_token_lockouts (
            web_user_id,
            locked_until,
            created_at,
            updated_at
        )
        values (
            new.web_user_id,
            timezone('utc', now()) + interval '15 minutes',
            timezone('utc', now()),
            timezone('utc', now())
        )
        on conflict (web_user_id) do update
        set
            locked_until = greatest(
                public.account_link_token_lockouts.locked_until,
                timezone('utc', now()) + interval '15 minutes'
            ),
            updated_at = timezone('utc', now());
    end if;

    return new;
end;
$$;

drop trigger if exists trigger_account_link_token_failure on public.account_link_token_failures;
create trigger trigger_account_link_token_failure
    after insert on public.account_link_token_failures
    for each row
    execute function public.handle_account_link_token_failure();

create or replace function public.generate_telegram_link_token(
    p_telegram_id bigint
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_token text;
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    if p_telegram_id is null or p_telegram_id <= 0 then
        raise exception 'Geçersiz Telegram ID'
            using errcode = '22023';
    end if;

    delete from public.account_link_tokens
    where telegram_id = p_telegram_id
       or expires_at < timezone('utc', now());

    v_token := lpad(floor(random() * 1000000)::text, 6, '0');

    while exists (
        select 1
        from public.account_link_tokens
        where token = v_token
    ) loop
        v_token := lpad(floor(random() * 1000000)::text, 6, '0');
    end loop;

    insert into public.account_link_tokens (telegram_id, token)
    values (p_telegram_id, v_token);

    return v_token;
end;
$$;

create or replace function public.link_telegram_account(
    p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_web_user_id uuid := auth.uid();
    v_telegram_id bigint;
    v_shadow_user_id uuid;
begin
    if v_web_user_id is null then
        raise exception 'Oturum açmadınız. İşlem reddedildi.'
            using errcode = '42501';
    end if;

    select telegram_id
    into v_telegram_id
    from public.account_link_tokens
    where token = p_token
      and expires_at > timezone('utc', now())
    for update;

    if v_telegram_id is null then
        raise exception 'Geçersiz veya süresi dolmuş token.'
            using errcode = '22023';
    end if;

    delete from public.account_link_tokens
    where token = p_token;

    select user_id
    into v_shadow_user_id
    from public.telegram_users
    where telegram_id = v_telegram_id;

    if v_shadow_user_id is not null then
        if v_shadow_user_id = v_web_user_id then
            return jsonb_build_object('success', true, 'message', 'Bu Telegram hesabı zaten profilinize bağlı.');
        end if;

        update public.quiz_attempts
        set user_id = v_web_user_id
        where user_id = v_shadow_user_id;

        update public.user_term_srs
        set user_id = v_web_user_id
        where user_id = v_shadow_user_id
          and term_id not in (
              select term_id
              from public.user_term_srs
              where user_id = v_web_user_id
          );

        insert into public.daily_learning_log (
            user_id,
            log_date,
            words_reviewed,
            words_correct,
            words_incorrect,
            new_words_learned
        )
        select
            v_web_user_id,
            log_date,
            words_reviewed,
            words_correct,
            words_incorrect,
            new_words_learned
        from public.daily_learning_log
        where user_id = v_shadow_user_id
        on conflict (user_id, log_date)
        do update set
            words_reviewed = public.daily_learning_log.words_reviewed + excluded.words_reviewed,
            words_correct = public.daily_learning_log.words_correct + excluded.words_correct,
            words_incorrect = public.daily_learning_log.words_incorrect + excluded.words_incorrect,
            new_words_learned = public.daily_learning_log.new_words_learned + excluded.new_words_learned;

        update public.telegram_users
        set user_id = v_web_user_id
        where telegram_id = v_telegram_id;

        delete from auth.users
        where id = v_shadow_user_id;
    else
        insert into public.telegram_users (telegram_id, user_id)
        values (v_telegram_id, v_web_user_id);
    end if;

    return jsonb_build_object(
        'success', true,
        'message', 'Hesap başarıyla birleştirildi!',
        'telegram_id', v_telegram_id
    );
end;
$$;

create or replace function public.link_telegram_account_v2(
    p_token text,
    p_web_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_caller_user_id uuid := auth.uid();
    v_telegram_id bigint;
    v_shadow_user_id uuid;
    v_locked_until timestamptz;
begin
    if p_web_user_id is null then
        raise exception 'Oturum açmadınız. İşlem reddedildi.'
            using errcode = '42501';
    end if;

    if v_request_role <> 'service_role' and v_caller_user_id is distinct from p_web_user_id then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    select locked_until
    into v_locked_until
    from public.account_link_token_lockouts
    where web_user_id = p_web_user_id
      and locked_until > timezone('utc', now());

    if v_locked_until is not null then
        raise exception 'Too many failed attempts. Please wait before retrying.'
            using errcode = 'P0001';
    end if;

    select telegram_id
    into v_telegram_id
    from public.account_link_tokens
    where token = p_token
      and expires_at > timezone('utc', now())
    for update;

    if v_telegram_id is null then
        insert into public.account_link_token_failures (web_user_id, attempted_token_hash)
        values (p_web_user_id, md5(coalesce(p_token, '')));

        select locked_until
        into v_locked_until
        from public.account_link_token_lockouts
        where web_user_id = p_web_user_id
          and locked_until > timezone('utc', now());

        if v_locked_until is not null then
            raise exception 'Too many failed attempts. Please wait before retrying.'
                using errcode = 'P0001';
        end if;

        raise exception 'Geçersiz veya süresi dolmuş token.'
            using errcode = '22023';
    end if;

    delete from public.account_link_tokens
    where token = p_token;

    select user_id
    into v_shadow_user_id
    from public.telegram_users
    where telegram_id = v_telegram_id;

    if v_shadow_user_id is not null then
        if v_shadow_user_id = p_web_user_id then
            delete from public.account_link_token_failures
            where web_user_id = p_web_user_id;

            delete from public.account_link_token_lockouts
            where web_user_id = p_web_user_id;

            return jsonb_build_object(
                'success', true,
                'message', 'Bu Telegram hesabı zaten profilinize bağlı.',
                'telegram_id', v_telegram_id
            );
        end if;

        update public.quiz_attempts
        set user_id = p_web_user_id
        where user_id = v_shadow_user_id;

        update public.user_term_srs
        set user_id = p_web_user_id
        where user_id = v_shadow_user_id
          and term_id not in (
              select term_id
              from public.user_term_srs
              where user_id = p_web_user_id
          );

        insert into public.daily_learning_log (
            user_id,
            log_date,
            words_reviewed,
            words_correct,
            words_incorrect,
            new_words_learned
        )
        select
            p_web_user_id,
            log_date,
            words_reviewed,
            words_correct,
            words_incorrect,
            new_words_learned
        from public.daily_learning_log
        where user_id = v_shadow_user_id
        on conflict (user_id, log_date)
        do update set
            words_reviewed = public.daily_learning_log.words_reviewed + excluded.words_reviewed,
            words_correct = public.daily_learning_log.words_correct + excluded.words_correct,
            words_incorrect = public.daily_learning_log.words_incorrect + excluded.words_incorrect,
            new_words_learned = public.daily_learning_log.new_words_learned + excluded.new_words_learned;

        update public.telegram_users
        set user_id = p_web_user_id
        where telegram_id = v_telegram_id;

        delete from auth.users
        where id = v_shadow_user_id;
    else
        insert into public.telegram_users (telegram_id, user_id)
        values (v_telegram_id, p_web_user_id);
    end if;

    delete from public.account_link_token_failures
    where web_user_id = p_web_user_id;

    delete from public.account_link_token_lockouts
    where web_user_id = p_web_user_id;

    return jsonb_build_object(
        'success', true,
        'message', 'Hesap başarıyla birleştirildi!',
        'telegram_id', v_telegram_id
    );
end;
$$;

create or replace function public.sync_telegram_user(
    p_telegram_id bigint,
    p_username text default null,
    p_default_language text default 'ru'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_user_id uuid;
    v_language text;
    v_email text;
begin
    if v_request_role <> 'service_role' then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    if p_telegram_id is null or p_telegram_id <= 0 then
        raise exception 'Geçersiz Telegram ID'
            using errcode = '22023';
    end if;

    select u.user_id, s.preferred_language
    into v_user_id, v_language
    from public.telegram_users as u
    left join public.user_settings as s
        on u.user_id = s.user_id
    where u.telegram_id = p_telegram_id;

    if v_user_id is not null then
        if p_username is not null then
            update public.telegram_users
            set telegram_username = p_username
            where telegram_id = p_telegram_id
              and (telegram_username is null or telegram_username <> p_username);
        end if;

        return jsonb_build_object(
            'user_id', v_user_id,
            'language', coalesce(v_language, p_default_language)
        );
    end if;

    v_user_id := gen_random_uuid();
    v_email := 'tg_' || p_telegram_id::text || '@fintechterms.bot';

    insert into auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data
    )
    values (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        crypt(gen_random_uuid()::text, gen_salt('bf')),
        timezone('utc', now()),
        timezone('utc', now()),
        timezone('utc', now()),
        '{"provider": "telegram", "providers": ["telegram"]}'::jsonb,
        jsonb_build_object('telegram_id', p_telegram_id, 'username', p_username)
    );

    insert into public.telegram_users (telegram_id, user_id, telegram_username)
    values (p_telegram_id, v_user_id, p_username);

    insert into public.user_settings (user_id, preferred_language)
    values (v_user_id, p_default_language)
    on conflict do nothing;

    insert into public.user_progress (user_id)
    values (v_user_id)
    on conflict do nothing;

    return jsonb_build_object('user_id', v_user_id, 'language', p_default_language);
end;
$$;

create or replace function public.log_daily_learning(
    p_user_id uuid,
    p_words_reviewed int default 0,
    p_words_correct int default 0,
    p_words_incorrect int default 0,
    p_new_words_learned int default 0
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
    v_date date := current_date;
begin
    if p_user_id is null then
        raise exception 'Geçersiz kullanıcı.'
            using errcode = '22023';
    end if;

    if v_request_role <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Access denied.'
            using errcode = '42501';
    end if;

    insert into public.daily_learning_log (
        user_id,
        log_date,
        words_reviewed,
        words_correct,
        words_incorrect,
        new_words_learned
    )
    values (
        p_user_id,
        v_date,
        greatest(coalesce(p_words_reviewed, 0), 0),
        greatest(coalesce(p_words_correct, 0), 0),
        greatest(coalesce(p_words_incorrect, 0), 0),
        greatest(coalesce(p_new_words_learned, 0), 0)
    )
    on conflict (user_id, log_date)
    do update set
        words_reviewed = public.daily_learning_log.words_reviewed + excluded.words_reviewed,
        words_correct = public.daily_learning_log.words_correct + excluded.words_correct,
        words_incorrect = public.daily_learning_log.words_incorrect + excluded.words_incorrect,
        new_words_learned = public.daily_learning_log.new_words_learned + excluded.new_words_learned,
        updated_at = timezone('utc', now());
end;
$$;

revoke all on function public.generate_telegram_link_token(bigint) from PUBLIC, anon, authenticated;
grant execute on function public.generate_telegram_link_token(bigint) to service_role;

revoke all on function public.link_telegram_account_v2(text, uuid) from PUBLIC, anon, authenticated;
grant execute on function public.link_telegram_account_v2(text, uuid) to service_role;

revoke all on function public.link_telegram_account(text) from PUBLIC, anon, authenticated, service_role;

revoke all on function public.sync_telegram_user(bigint, text, text) from PUBLIC, anon, authenticated;
grant execute on function public.sync_telegram_user(bigint, text, text) to service_role;

revoke all on function public.log_daily_learning(uuid, integer, integer, integer, integer) from PUBLIC, anon, authenticated;
grant execute on function public.log_daily_learning(uuid, integer, integer, integer, integer) to service_role;
