alter table if exists public.user_settings
    alter column preferred_language set default 'ru';

update public.user_settings
set preferred_language = 'ru',
    updated_at = timezone('utc', now())
where preferred_language is null
   or btrim(preferred_language) = '';

comment on column public.user_settings.preferred_language is
    'Russian-first default. Missing translations and new user settings default to ''ru''.';
