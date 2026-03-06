do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n
            on n.oid = t.typnamespace
        where t.typname = 'regional_market'
          and n.nspname = 'public'
    ) then
        create type public.regional_market as enum ('MOEX', 'BIST', 'GLOBAL');
    end if;
end
$$;

alter table public.terms
    add column if not exists context_tags jsonb not null default '{}'::jsonb,
    add column if not exists regional_market public.regional_market not null default 'GLOBAL';

alter table public.terms
    drop constraint if exists terms_context_tags_object_check;

alter table public.terms
    add constraint terms_context_tags_object_check
    check (jsonb_typeof(context_tags) = 'object');

comment on column public.terms.context_tags is
    'Structured contest taxonomy for each term: disciplines, contest_tracks, target_universities, market_topics, and related academic metadata.';

comment on column public.terms.regional_market is
    'Primary contest-market alignment for a term: MOEX, BIST, or GLOBAL.';

create index if not exists idx_terms_regional_market
    on public.terms (regional_market);

create index if not exists idx_terms_context_tags
    on public.terms
    using gin (context_tags jsonb_path_ops);

update public.terms
set regional_market = case
    when (
        coalesce(term_en, '') ilike '%moex%'
        or coalesce(term_ru, '') ilike '%мосбир%'
        or coalesce(definition_en, '') ilike '%moex%'
        or coalesce(definition_ru, '') ilike '%мосбир%'
    ) then 'MOEX'::public.regional_market
    when (
        coalesce(term_en, '') ilike '%bist%'
        or coalesce(term_tr, '') ilike '%bist%'
        or coalesce(definition_en, '') ilike '%bist%'
        or coalesce(definition_tr, '') ilike '%borsa istanbul%'
    ) then 'BIST'::public.regional_market
    else 'GLOBAL'::public.regional_market
end
where regional_market is null
   or regional_market = 'GLOBAL'::public.regional_market;

update public.terms
set context_tags = jsonb_build_object(
    'disciplines',
    case
        when category = 'Technology' then jsonb_build_array('mis')
        when category = 'Finance' then jsonb_build_array('economics')
        when category = 'Fintech' then jsonb_build_array('economics', 'mis')
        else jsonb_build_array('economics')
    end,
    'contest_tracks',
    case
        when category = 'Technology' then jsonb_build_array('mis')
        when category in ('Finance', 'Fintech') then jsonb_build_array('economics')
        else jsonb_build_array('economics')
    end,
    'target_universities',
    jsonb_build_array('SPbU', 'HSE'),
    'market_topics',
    jsonb_build_array(regional_market::text),
    'contest_profile',
    case
        when category = 'Technology' then 'russian-mis'
        when category = 'Finance' then 'russian-economics'
        when category = 'Fintech' then 'comparative-economics-mis'
        else 'russian-economics'
    end
)
where context_tags is null
   or context_tags = '{}'::jsonb;

create table if not exists public.academic_decks (
    id uuid primary key default uuid_generate_v4(),
    slug text not null,
    title_ru text not null,
    title_en text not null,
    title_tr text not null,
    description_ru text not null,
    description_en text not null,
    description_tr text not null,
    program_track text not null,
    target_universities text[] not null default '{}'::text[],
    focus_markets public.regional_market[] not null default array['GLOBAL'::public.regional_market],
    context_profile jsonb not null default '{}'::jsonb,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint academic_decks_slug_unique unique (slug),
    constraint academic_decks_program_track_check check (
        program_track in ('Economics', 'MIS', 'Finance', 'Cross-disciplinary')
    ),
    constraint academic_decks_focus_markets_nonempty check (
        coalesce(array_length(focus_markets, 1), 0) > 0
    ),
    constraint academic_decks_context_profile_object_check check (
        jsonb_typeof(context_profile) = 'object'
    )
);

create index if not exists idx_academic_decks_program_track_sort
    on public.academic_decks (program_track, sort_order, slug);

comment on table public.academic_decks is
    'Contest-ready academic decks for Russian-first university applicants, including SPbU/HSE Economics and MIS pathways.';

create table if not exists public.academic_deck_terms (
    id uuid primary key default uuid_generate_v4(),
    deck_id uuid not null references public.academic_decks(id) on delete cascade,
    term_id text not null references public.terms(id) on delete cascade,
    sort_order integer not null default 0,
    required_for_track boolean not null default true,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    constraint academic_deck_terms_unique unique (deck_id, term_id),
    constraint academic_deck_terms_metadata_object_check check (
        jsonb_typeof(metadata) = 'object'
    )
);

create index if not exists idx_academic_deck_terms_deck_sort
    on public.academic_deck_terms (deck_id, sort_order, term_id);

create index if not exists idx_academic_deck_terms_term_id
    on public.academic_deck_terms (term_id);

comment on table public.academic_deck_terms is
    'Join table mapping contest-ready academic decks to terms.';

alter table public.academic_decks enable row level security;
alter table public.academic_deck_terms enable row level security;

drop policy if exists "Public can read academic decks" on public.academic_decks;
create policy "Public can read academic decks"
    on public.academic_decks
    for select
    using (true);

drop policy if exists "Public can read academic deck terms" on public.academic_deck_terms;
create policy "Public can read academic deck terms"
    on public.academic_deck_terms
    for select
    using (true);

drop policy if exists "Service role can manage academic decks" on public.academic_decks;
create policy "Service role can manage academic decks"
    on public.academic_decks
    for all
    to service_role
    using (true)
    with check (true);

drop policy if exists "Service role can manage academic deck terms" on public.academic_deck_terms;
create policy "Service role can manage academic deck terms"
    on public.academic_deck_terms
    for all
    to service_role
    using (true)
    with check (true);

drop trigger if exists update_academic_decks_updated_at on public.academic_decks;
create trigger update_academic_decks_updated_at
    before update on public.academic_decks
    for each row
    execute function public.update_updated_at_column();

insert into public.academic_decks (
    slug,
    title_ru,
    title_en,
    title_tr,
    description_ru,
    description_en,
    description_tr,
    program_track,
    target_universities,
    focus_markets,
    context_profile,
    sort_order
)
values
    (
        'spbu-economics-moex-core',
        'Экономика СПбГУ: ядро терминов MOEX',
        'SPbU Economics: MOEX Core Vocabulary',
        'SPbU Ekonomi: MOEX Çekirdek Terminolojisi',
        'Базовая колода для абитуриентов СПбГУ по экономике с упором на российскую рыночную лексику и логику MOEX.',
        'Core vocabulary deck for SPbU Economics applicants focused on Russian-market terminology and MOEX context.',
        'Rusya piyasası terminolojisi ve MOEX bağlamına odaklanan SPbU Ekonomi adayları için çekirdek deste.',
        'Economics',
        array['SPbU']::text[],
        array['MOEX'::public.regional_market, 'GLOBAL'::public.regional_market],
        jsonb_build_object(
            'contest_track', 'economics',
            'applicant_segment', 'russian-first',
            'recommended_for', jsonb_build_array('SPbU', 'Economics'),
            'focus', 'moex'
        ),
        10
    ),
    (
        'hse-economics-comparative-core',
        'Экономика ВШЭ: сравнительная лексика MOEX/BIST',
        'HSE Economics: Comparative MOEX/BIST Vocabulary',
        'HSE Ekonomi: Karşılaştırmalı MOEX/BIST Terminolojisi',
        'Колода для абитуриентов ВШЭ по экономике, связывающая российскую и турецкую финансовую лексику.',
        'Applicant deck for HSE Economics that links Russian and Turkish market vocabulary in a comparative track.',
        'Rus ve Türk piyasa terminolojisini karşılaştırmalı bir hatta birleştiren HSE Ekonomi aday deste.',
        'Economics',
        array['HSE']::text[],
        array['MOEX'::public.regional_market, 'BIST'::public.regional_market, 'GLOBAL'::public.regional_market],
        jsonb_build_object(
            'contest_track', 'economics',
            'applicant_segment', 'russian-first',
            'recommended_for', jsonb_build_array('HSE', 'Economics'),
            'focus', 'comparative-markets'
        ),
        20
    ),
    (
        'russian-mis-market-infrastructure',
        'MIS для абитуриентов РФ: рыночная инфраструктура',
        'Russian-Applicant MIS: Market Infrastructure',
        'Rus Aday MIS: Piyasa Altyapısı',
        'Колода MIS/Economics для абитуриентов РФ, связывающая цифровую инфраструктуру, финтех и биржевые рынки.',
        'MIS/Economics bridge deck for Russian applicants covering digital infrastructure, fintech, and exchange markets.',
        'Dijital altyapı, fintek ve borsa piyasalarını kapsayan Rus adaylara yönelik MIS/Ekonomi köprü deste.',
        'MIS',
        array['SPbU', 'HSE']::text[],
        array['MOEX'::public.regional_market, 'BIST'::public.regional_market, 'GLOBAL'::public.regional_market],
        jsonb_build_object(
            'contest_track', 'mis',
            'applicant_segment', 'russian-first',
            'recommended_for', jsonb_build_array('SPbU', 'HSE', 'MIS'),
            'focus', 'market-infrastructure'
        ),
        30
    )
on conflict (slug) do update
set
    title_ru = excluded.title_ru,
    title_en = excluded.title_en,
    title_tr = excluded.title_tr,
    description_ru = excluded.description_ru,
    description_en = excluded.description_en,
    description_tr = excluded.description_tr,
    program_track = excluded.program_track,
    target_universities = excluded.target_universities,
    focus_markets = excluded.focus_markets,
    context_profile = excluded.context_profile,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = timezone('utc', now());

with seeded_decks as (
    select id, slug
    from public.academic_decks
    where slug in (
        'spbu-economics-moex-core',
        'hse-economics-comparative-core',
        'russian-mis-market-infrastructure'
    )
),
candidate_terms as (
    select
        deck.id as deck_id,
        deck.slug,
        term.id as term_id,
        row_number() over (
            partition by deck.id
            order by
                case
                    when deck.slug = 'spbu-economics-moex-core'
                         and term.regional_market = 'MOEX'::public.regional_market then 0
                    when deck.slug = 'hse-economics-comparative-core'
                         and term.regional_market in ('MOEX'::public.regional_market, 'BIST'::public.regional_market) then 0
                    when deck.slug = 'russian-mis-market-infrastructure'
                         and term.category = 'Technology' then 0
                    else 1
                end,
                term.category,
                coalesce(nullif(term.term_ru, ''), term.term_en, term.id),
                term.id
        ) - 1 as sort_order,
        jsonb_build_object(
            'seed_rule',
            case
                when deck.slug = 'spbu-economics-moex-core' then 'economics-core'
                when deck.slug = 'hse-economics-comparative-core' then 'economics-comparative'
                else 'mis-market-infrastructure'
            end,
            'regional_market',
            term.regional_market::text,
            'category',
            term.category
        ) as metadata,
        case
            when deck.slug = 'russian-mis-market-infrastructure'
                 and term.category = 'Fintech' then false
            else true
        end as required_for_track
    from seeded_decks as deck
    join public.terms as term
        on (
            deck.slug = 'spbu-economics-moex-core'
            and (
                term.category in ('Finance', 'Fintech')
                or term.context_tags @> '{"disciplines":["economics"]}'::jsonb
            )
        )
        or (
            deck.slug = 'hse-economics-comparative-core'
            and (
                term.category in ('Finance', 'Fintech')
                or term.context_tags @> '{"contest_tracks":["economics"]}'::jsonb
            )
        )
        or (
            deck.slug = 'russian-mis-market-infrastructure'
            and (
                term.category in ('Technology', 'Fintech')
                or term.context_tags @> '{"disciplines":["mis"]}'::jsonb
            )
        )
)
insert into public.academic_deck_terms (
    deck_id,
    term_id,
    sort_order,
    required_for_track,
    metadata
)
select
    candidate_terms.deck_id,
    candidate_terms.term_id,
    candidate_terms.sort_order,
    candidate_terms.required_for_track,
    candidate_terms.metadata
from candidate_terms
on conflict (deck_id, term_id) do update
set
    sort_order = excluded.sort_order,
    required_for_track = excluded.required_for_track,
    metadata = excluded.metadata;
