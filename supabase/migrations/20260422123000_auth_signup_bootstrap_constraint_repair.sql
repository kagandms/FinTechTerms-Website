alter table public.user_progress
    drop constraint if exists user_progress_id_fkey;

create or replace function public.verify_auth_signup_bootstrap_readiness()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
    checks jsonb;
    is_ok boolean;
begin
    checks := jsonb_build_object(
        'user_progress_id_not_auth_user_fk',
        not exists (
            select 1
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
            join pg_class rt on rt.oid = c.confrelid
            join pg_namespace rn on rn.oid = rt.relnamespace
            join pg_attribute a on a.attrelid = t.oid
                and a.attnum = c.conkey[1]
            where c.contype = 'f'
              and n.nspname = 'public'
              and t.relname = 'user_progress'
              and rn.nspname = 'auth'
              and rt.relname = 'users'
              and a.attname = 'id'
        ),
        'user_progress_user_id_auth_user_fk',
        exists (
            select 1
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
            join pg_class rt on rt.oid = c.confrelid
            join pg_namespace rn on rn.oid = rt.relnamespace
            join pg_attribute a on a.attrelid = t.oid
                and a.attnum = c.conkey[1]
            where c.contype = 'f'
              and n.nspname = 'public'
              and t.relname = 'user_progress'
              and rn.nspname = 'auth'
              and rt.relname = 'users'
              and a.attname = 'user_id'
        ),
        'auth_user_profile_trigger_enabled',
        exists (
            select 1
            from pg_trigger t
            join pg_proc p on p.oid = t.tgfoid
            join pg_namespace n on n.oid = p.pronamespace
            where t.tgrelid = 'auth.users'::regclass
              and t.tgname = 'on_auth_user_created_profile'
              and n.nspname = 'public'
              and p.proname = 'handle_new_profile'
              and t.tgenabled = 'O'
        ),
        'auth_user_bootstrap_trigger_enabled',
        exists (
            select 1
            from pg_trigger t
            join pg_proc p on p.oid = t.tgfoid
            join pg_namespace n on n.oid = p.pronamespace
            where t.tgrelid = 'auth.users'::regclass
              and t.tgname = 'on_auth_user_created_bootstrap'
              and n.nspname = 'public'
              and p.proname = 'bootstrap_user_state'
              and t.tgenabled = 'O'
        )
    );

    select bool_and(value::boolean)
    into is_ok
    from jsonb_each_text(checks);

    return jsonb_build_object(
        'ok', coalesce(is_ok, false),
        'checks', checks
    );
end;
$$;

revoke all on function public.verify_auth_signup_bootstrap_readiness() from public, anon, authenticated;
grant execute on function public.verify_auth_signup_bootstrap_readiness() to service_role;
