create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where t.typname = 'regional_market'
          and n.nspname = 'public'
    ) then
        create type public.regional_market as enum ('MOEX', 'BIST', 'GLOBAL');
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where t.typname = 'difficulty_level'
          and n.nspname = 'public'
    ) then
        create type public.difficulty_level as enum ('basic', 'intermediate', 'advanced');
    end if;
end;
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    birth_date date,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
    add column if not exists full_name text,
    add column if not exists birth_date date,
    add column if not exists created_at timestamptz not null default timezone('utc', now()),
    add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.update_updated_at_column();

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
    on public.profiles
    for insert
    to authenticated
    with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

drop policy if exists "Service role can manage profiles" on public.profiles;
create policy "Service role can manage profiles"
    on public.profiles
    for all
    to service_role
    using (true)
    with check (true);

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    raw_birth_date text;
begin
    raw_birth_date := trim(coalesce(new.raw_user_meta_data->>'birth_date', ''));

    insert into public.profiles (
        id,
        full_name,
        birth_date,
        created_at,
        updated_at
    )
    values (
        new.id,
        nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), ''),
        case
            when raw_birth_date ~ '^\d{4}-\d{2}-\d{2}$' then raw_birth_date::date
            else null
        end,
        timezone('utc', now()),
        timezone('utc', now())
    )
    on conflict (id) do update
    set
        full_name = coalesce(
            excluded.full_name,
            public.profiles.full_name
        ),
        birth_date = coalesce(
            excluded.birth_date,
            public.profiles.birth_date
        ),
        updated_at = timezone('utc', now());

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
    after insert on auth.users
    for each row
    execute function public.handle_new_profile();

insert into public.profiles (id, full_name, birth_date, created_at, updated_at)
select
    u.id,
    nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), ''),
    case
        when trim(coalesce(u.raw_user_meta_data->>'birth_date', '')) ~ '^\d{4}-\d{2}-\d{2}$'
            then trim(u.raw_user_meta_data->>'birth_date')::date
        else null
    end,
    coalesce(u.created_at, timezone('utc', now())),
    coalesce(u.updated_at, timezone('utc', now()))
from auth.users as u
on conflict (id) do update
set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    birth_date = coalesce(excluded.birth_date, public.profiles.birth_date),
    updated_at = timezone('utc', now());

create table if not exists public.terms (
    id text primary key,
    slug text not null default '',
    term_en text not null,
    term_ru text not null,
    term_tr text not null,
    phonetic_en text,
    phonetic_ru text,
    phonetic_tr text,
    category text not null,
    definition_en text not null,
    definition_ru text not null,
    definition_tr text not null,
    example_sentence_en text not null,
    example_sentence_ru text not null,
    example_sentence_tr text not null,
    short_definition jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    expanded_definition jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    why_it_matters jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    how_it_works jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    risks_and_pitfalls jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    regional_notes jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    seo_title jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    seo_description jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    context_tags jsonb not null default '{}'::jsonb,
    regional_markets public.regional_market[] not null default array['GLOBAL'::public.regional_market],
    primary_market public.regional_market not null default 'GLOBAL',
    regional_market public.regional_market not null default 'GLOBAL',
    is_academic boolean not null default true,
    difficulty_level public.difficulty_level not null default 'intermediate',
    related_term_ids text[] not null default '{}'::text[],
    comparison_term_id text,
    prerequisite_term_id text,
    topic_ids text[] not null default '{}'::text[],
    source_refs text[] not null default '{}'::text[],
    author_id text not null default 'kagan-samet-durmus',
    reviewer_id text not null default 'fintechterms-editorial-review',
    reviewed_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    index_priority text not null default 'standard',
    constraint terms_context_tags_object_check check (jsonb_typeof(context_tags) = 'object'),
    constraint terms_short_definition_object_check check (jsonb_typeof(short_definition) = 'object'),
    constraint terms_expanded_definition_object_check check (jsonb_typeof(expanded_definition) = 'object'),
    constraint terms_why_it_matters_object_check check (jsonb_typeof(why_it_matters) = 'object'),
    constraint terms_how_it_works_object_check check (jsonb_typeof(how_it_works) = 'object'),
    constraint terms_risks_and_pitfalls_object_check check (jsonb_typeof(risks_and_pitfalls) = 'object'),
    constraint terms_regional_notes_object_check check (jsonb_typeof(regional_notes) = 'object'),
    constraint terms_seo_title_object_check check (jsonb_typeof(seo_title) = 'object'),
    constraint terms_seo_description_object_check check (jsonb_typeof(seo_description) = 'object'),
    constraint terms_index_priority_check check (index_priority in ('high', 'standard', 'supporting'))
);

alter table public.terms
    add column if not exists slug text not null default '',
    add column if not exists short_definition jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    add column if not exists expanded_definition jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    add column if not exists why_it_matters jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    add column if not exists how_it_works jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    add column if not exists risks_and_pitfalls jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    add column if not exists regional_notes jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    add column if not exists seo_title jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    add column if not exists seo_description jsonb not null default '{"en":"","ru":"","tr":""}'::jsonb,
    add column if not exists regional_markets public.regional_market[] not null default array['GLOBAL'::public.regional_market],
    add column if not exists primary_market public.regional_market not null default 'GLOBAL',
    add column if not exists related_term_ids text[] not null default '{}'::text[],
    add column if not exists comparison_term_id text,
    add column if not exists prerequisite_term_id text,
    add column if not exists topic_ids text[] not null default '{}'::text[],
    add column if not exists source_refs text[] not null default '{}'::text[],
    add column if not exists author_id text not null default 'kagan-samet-durmus',
    add column if not exists reviewer_id text not null default 'fintechterms-editorial-review',
    add column if not exists reviewed_at timestamptz not null default timezone('utc', now()),
    add column if not exists index_priority text not null default 'standard';

update public.terms
set slug = trim(both '-' from regexp_replace(
    lower(replace(term_en, '&', ' and ')),
    '[^a-z0-9]+',
    '-',
    'g'
))
where coalesce(trim(slug), '') = '';

update public.terms
set
    short_definition = case when jsonb_typeof(short_definition) = 'object' then short_definition else '{"en":"","ru":"","tr":""}'::jsonb end,
    expanded_definition = case when jsonb_typeof(expanded_definition) = 'object' then expanded_definition else '{"en":"","ru":"","tr":""}'::jsonb end,
    why_it_matters = case when jsonb_typeof(why_it_matters) = 'object' then why_it_matters else '{"en":"","ru":"","tr":""}'::jsonb end,
    how_it_works = case when jsonb_typeof(how_it_works) = 'object' then how_it_works else '{"en":"","ru":"","tr":""}'::jsonb end,
    risks_and_pitfalls = case when jsonb_typeof(risks_and_pitfalls) = 'object' then risks_and_pitfalls else '{"en":"","ru":"","tr":""}'::jsonb end,
    regional_notes = case when jsonb_typeof(regional_notes) = 'object' then regional_notes else '{"en":"","ru":"","tr":""}'::jsonb end,
    seo_title = case when jsonb_typeof(seo_title) = 'object' then seo_title else '{"en":"","ru":"","tr":""}'::jsonb end,
    seo_description = case when jsonb_typeof(seo_description) = 'object' then seo_description else '{"en":"","ru":"","tr":""}'::jsonb end,
    regional_markets = case
        when coalesce(array_length(regional_markets, 1), 0) > 0 then regional_markets
        else array[coalesce(primary_market, regional_market, 'GLOBAL'::public.regional_market)]
    end,
    primary_market = coalesce(primary_market, regional_market, 'GLOBAL'::public.regional_market),
    regional_market = coalesce(regional_market, primary_market, 'GLOBAL'::public.regional_market),
    related_term_ids = coalesce(related_term_ids, '{}'::text[]),
    topic_ids = coalesce(topic_ids, '{}'::text[]),
    source_refs = coalesce(source_refs, '{}'::text[]),
    author_id = coalesce(nullif(trim(author_id), ''), 'kagan-samet-durmus'),
    reviewer_id = coalesce(nullif(trim(reviewer_id), ''), 'fintechterms-editorial-review'),
    index_priority = case
        when index_priority in ('high', 'standard', 'supporting') then index_priority
        else 'standard'
    end;

create index if not exists idx_terms_regional_market on public.terms (regional_market);
create index if not exists idx_terms_context_tags on public.terms using gin (context_tags jsonb_path_ops);
create index if not exists idx_terms_is_academic on public.terms (is_academic);
create index if not exists idx_terms_difficulty_level on public.terms (difficulty_level);
create index if not exists idx_terms_term_en_trgm on public.terms using gin (term_en gin_trgm_ops);
create index if not exists idx_terms_term_ru_trgm on public.terms using gin (term_ru gin_trgm_ops);
create index if not exists idx_terms_term_tr_trgm on public.terms using gin (term_tr gin_trgm_ops);

alter table public.terms enable row level security;

drop policy if exists "Public read access" on public.terms;
create policy "Public read access"
    on public.terms
    for select
    using (true);

grant usage on schema public to anon, authenticated, service_role;
grant usage on type public.difficulty_level to anon, authenticated, service_role;
grant usage on type public.regional_market to anon, authenticated, service_role;
grant select on public.terms to anon, authenticated;
grant all privileges on public.terms to service_role;

create or replace function public.search_terms_trigram(
    search_query text,
    max_limit integer default 10
)
returns setof public.terms
language sql
stable
set search_path = public
as $$
    with normalized as (
        select nullif(trim(search_query), '') as query
    )
    select t.*
    from public.terms as t
    cross join normalized
    where normalized.query is not null
      and t.is_academic is distinct from false
      and (
        t.term_en ilike '%' || normalized.query || '%'
        or t.term_ru ilike '%' || normalized.query || '%'
        or t.term_tr ilike '%' || normalized.query || '%'
        or t.term_en % normalized.query
        or t.term_ru % normalized.query
        or t.term_tr % normalized.query
      )
    order by greatest(
        similarity(t.term_en, normalized.query),
        similarity(t.term_ru, normalized.query),
        similarity(t.term_tr, normalized.query)
    ) desc,
    t.term_en asc
    limit greatest(1, least(coalesce(max_limit, 10), 25));
$$;

grant execute on function public.search_terms_trigram(text, integer) to anon, authenticated, service_role;

create table if not exists public.user_progress (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    favorites text[] not null default '{}'::text[],
    current_streak integer not null default 0,
    last_study_date timestamptz,
    total_words_learned integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_progress
    add column if not exists favorites text[] not null default '{}'::text[],
    add column if not exists current_streak integer not null default 0,
    add column if not exists last_study_date timestamptz,
    add column if not exists total_words_learned integer not null default 0,
    add column if not exists created_at timestamptz not null default timezone('utc', now()),
    add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists idx_user_progress_user_unique
    on public.user_progress (user_id);

drop trigger if exists update_user_progress_updated_at on public.user_progress;
create trigger update_user_progress_updated_at
    before update on public.user_progress
    for each row
    execute function public.update_updated_at_column();

alter table public.user_progress enable row level security;

drop policy if exists "Users can view own progress" on public.user_progress;
create policy "Users can view own progress"
    on public.user_progress
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own progress" on public.user_progress;
create policy "Users can insert own progress"
    on public.user_progress
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own progress" on public.user_progress;
create policy "Users can update own progress"
    on public.user_progress
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

grant select, insert, update on public.user_progress to authenticated;
grant all on public.user_progress to service_role;

create table if not exists public.user_favorites (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    term_id text not null references public.terms(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    source text not null default 'web',
    constraint user_favorites_unique unique (user_id, term_id)
);

alter table public.user_favorites
    add column if not exists created_at timestamptz not null default timezone('utc', now()),
    add column if not exists source text not null default 'web';

create index if not exists idx_user_favorites_user_created_at
    on public.user_favorites (user_id, created_at desc);
create index if not exists idx_user_favorites_term_id
    on public.user_favorites (term_id);

alter table public.user_favorites enable row level security;

drop policy if exists "Users can view own favorites" on public.user_favorites;
create policy "Users can view own favorites"
    on public.user_favorites
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Service role can manage user favorites" on public.user_favorites;
create policy "Service role can manage user favorites"
    on public.user_favorites
    for all
    to service_role
    using (true)
    with check (true);

revoke all on public.user_favorites from anon;
grant select on public.user_favorites to authenticated;
grant all on public.user_favorites to service_role;

create table if not exists public.study_sessions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    anonymous_id text,
    session_start timestamptz not null default timezone('utc', now()),
    session_end timestamptz,
    duration_seconds integer,
    page_views integer,
    quiz_attempts integer,
    device_type text not null default 'unknown',
    user_agent text,
    consent_given boolean not null default false,
    consent_timestamp timestamptz,
    idempotency_key text,
    session_token_hash text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint study_sessions_metrics_non_negative check (
        (duration_seconds is null or duration_seconds >= 0)
        and (page_views is null or page_views >= 0)
        and (quiz_attempts is null or quiz_attempts >= 0)
    ),
    constraint study_sessions_device_type_check check (
        device_type in ('mobile', 'tablet', 'desktop', 'unknown')
    )
);

alter table public.study_sessions
    add column if not exists user_id uuid references auth.users(id) on delete cascade,
    add column if not exists anonymous_id text,
    add column if not exists session_start timestamptz not null default timezone('utc', now()),
    add column if not exists session_end timestamptz,
    add column if not exists duration_seconds integer,
    add column if not exists page_views integer,
    add column if not exists quiz_attempts integer,
    add column if not exists device_type text not null default 'unknown',
    add column if not exists user_agent text,
    add column if not exists consent_given boolean not null default false,
    add column if not exists consent_timestamp timestamptz,
    add column if not exists idempotency_key text,
    add column if not exists session_token_hash text,
    add column if not exists created_at timestamptz not null default timezone('utc', now()),
    add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop trigger if exists update_study_sessions_updated_at on public.study_sessions;
create trigger update_study_sessions_updated_at
    before update on public.study_sessions
    for each row
    execute function public.update_updated_at_column();

create unique index if not exists idx_study_sessions_user_idempotency_key
    on public.study_sessions (user_id, idempotency_key)
    where user_id is not null
      and idempotency_key is not null;

create unique index if not exists idx_study_sessions_anonymous_idempotency_key
    on public.study_sessions (anonymous_id, idempotency_key)
    where anonymous_id is not null
      and idempotency_key is not null;

create index if not exists idx_study_sessions_session_token_hash
    on public.study_sessions (session_token_hash)
    where session_token_hash is not null;

alter table public.study_sessions enable row level security;

drop policy if exists "Users can view own sessions" on public.study_sessions;
create policy "Users can view own sessions"
    on public.study_sessions
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Service role can manage study sessions" on public.study_sessions;
create policy "Service role can manage study sessions"
    on public.study_sessions
    for all
    to service_role
    using (true)
    with check (true);

revoke all on public.study_sessions from anon, authenticated;
grant select on public.study_sessions to authenticated;
grant all on public.study_sessions to service_role;

create table if not exists public.quiz_attempts (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    term_id text not null references public.terms(id) on delete cascade,
    session_id uuid references public.study_sessions(id) on delete cascade,
    is_correct boolean not null default false,
    response_time_ms integer not null default 0,
    quiz_type text not null default 'daily',
    idempotency_key text,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.quiz_attempts
    add column if not exists session_id uuid references public.study_sessions(id) on delete cascade,
    add column if not exists idempotency_key text,
    add column if not exists response_time_ms integer not null default 0,
    add column if not exists quiz_type text not null default 'daily',
    add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists idx_quiz_attempts_user_id on public.quiz_attempts (user_id);
create index if not exists idx_quiz_attempts_term_id on public.quiz_attempts (term_id);
create index if not exists idx_quiz_attempts_session_id on public.quiz_attempts (session_id);
create unique index if not exists idx_quiz_attempts_user_idempotency_key_full
    on public.quiz_attempts (user_id, idempotency_key)
    where idempotency_key is not null;

alter table public.quiz_attempts enable row level security;

drop policy if exists "Users can view own quiz attempts" on public.quiz_attempts;
create policy "Users can view own quiz attempts"
    on public.quiz_attempts
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own quiz attempts" on public.quiz_attempts;
create policy "Users can insert own quiz attempts"
    on public.quiz_attempts
    for insert
    to authenticated
    with check (auth.uid() = user_id);

grant select, insert on public.quiz_attempts to authenticated;
grant all on public.quiz_attempts to service_role;

create table if not exists public.user_term_srs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    term_id text not null references public.terms(id) on delete cascade,
    srs_level integer not null default 1,
    next_review_date timestamptz not null default timezone('utc', now()),
    last_reviewed timestamptz,
    difficulty_score real not null default 2.5,
    retention_rate real not null default 0,
    times_reviewed integer not null default 0,
    times_correct integer not null default 0
);

alter table public.user_term_srs
    add column if not exists srs_level integer not null default 1,
    add column if not exists next_review_date timestamptz not null default timezone('utc', now()),
    add column if not exists last_reviewed timestamptz,
    add column if not exists difficulty_score real not null default 2.5,
    add column if not exists retention_rate real not null default 0,
    add column if not exists times_reviewed integer not null default 0,
    add column if not exists times_correct integer not null default 0;

create unique index if not exists idx_user_term_srs_user_term
    on public.user_term_srs (user_id, term_id);
create index if not exists idx_user_term_srs_user_id on public.user_term_srs (user_id);
create index if not exists idx_user_term_srs_next_review on public.user_term_srs (next_review_date);

alter table public.user_term_srs enable row level security;

drop policy if exists "Users can view own SRS data" on public.user_term_srs;
create policy "Users can view own SRS data"
    on public.user_term_srs
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own SRS data" on public.user_term_srs;
create policy "Users can insert own SRS data"
    on public.user_term_srs
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own SRS data" on public.user_term_srs;
create policy "Users can update own SRS data"
    on public.user_term_srs
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

grant select, insert, update on public.user_term_srs to authenticated;
grant all on public.user_term_srs to service_role;

create table if not exists public.user_settings (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    preferred_language text not null default 'ru',
    theme text not null default 'system',
    daily_goal integer not null default 10,
    notification_enabled boolean not null default true,
    sound_enabled boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint user_settings_language_check check (preferred_language in ('ru', 'en', 'tr')),
    constraint user_settings_theme_check check (theme in ('light', 'dark', 'system'))
);

alter table public.user_settings
    add column if not exists preferred_language text not null default 'ru',
    add column if not exists theme text not null default 'system',
    add column if not exists daily_goal integer not null default 10,
    add column if not exists notification_enabled boolean not null default true,
    add column if not exists sound_enabled boolean not null default true,
    add column if not exists created_at timestamptz not null default timezone('utc', now()),
    add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists idx_user_settings_user_unique
    on public.user_settings (user_id);

drop trigger if exists update_user_settings_updated_at on public.user_settings;
create trigger update_user_settings_updated_at
    before update on public.user_settings
    for each row
    execute function public.update_updated_at_column();

alter table public.user_settings enable row level security;

drop policy if exists "Users can view own settings" on public.user_settings;
create policy "Users can view own settings"
    on public.user_settings
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
    on public.user_settings
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
    on public.user_settings
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

grant select, insert, update on public.user_settings to authenticated;
grant all on public.user_settings to service_role;

create table if not exists public.daily_learning_log (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    log_date date not null default current_date,
    words_reviewed integer not null default 0,
    words_correct integer not null default 0,
    words_incorrect integer not null default 0,
    new_words_learned integer not null default 0,
    time_spent_seconds integer not null default 0,
    session_count integer not null default 1,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint daily_learning_log_unique unique (user_id, log_date)
);

alter table public.daily_learning_log enable row level security;

drop policy if exists "Users can view own daily logs" on public.daily_learning_log;
create policy "Users can view own daily logs"
    on public.daily_learning_log
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily logs" on public.daily_learning_log;
create policy "Users can insert own daily logs"
    on public.daily_learning_log
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily logs" on public.daily_learning_log;
create policy "Users can update own daily logs"
    on public.daily_learning_log
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

grant select, insert, update on public.daily_learning_log to authenticated;
grant all on public.daily_learning_log to service_role;
