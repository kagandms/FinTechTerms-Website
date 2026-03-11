do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n
            on n.oid = t.typnamespace
        where t.typname = 'difficulty_level'
          and n.nspname = 'public'
    ) then
        create type public.difficulty_level as enum ('basic', 'intermediate', 'advanced');
    end if;
end
$$;

alter table public.terms
    add column if not exists is_academic boolean not null default true,
    add column if not exists difficulty_level public.difficulty_level not null default 'intermediate';

comment on column public.terms.is_academic is
    'Soft-quarantine flag. Terms marked false stay in the database but are hidden from the main academic contest flows.';

comment on column public.terms.difficulty_level is
    'Academic difficulty band for contest curation: basic, intermediate, or advanced.';

create index if not exists idx_terms_is_academic
    on public.terms (is_academic);

create index if not exists idx_terms_difficulty_level
    on public.terms (difficulty_level);
