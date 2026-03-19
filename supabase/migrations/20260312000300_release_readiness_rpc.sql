create or replace function public.verify_release_readiness()
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
        'terms_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'terms'
        ),
        'profiles_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'profiles'
        ),
        'user_progress_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'user_progress'
        ),
        'quiz_attempts_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'quiz_attempts'
        ),
        'user_term_srs_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'user_term_srs'
        ),
        'user_settings_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'user_settings'
        ),
        'user_favorites_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'user_favorites'
        ),
        'profiles_rls_enabled',
        exists (
            select 1
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname = 'profiles'
              and c.relrowsecurity = true
        ),
        'terms_rls_enabled',
        exists (
            select 1
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname = 'terms'
              and c.relrowsecurity = true
        ),
        'study_sessions_table_exists',
        exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = 'study_sessions'
        ),
        'study_sessions_session_token_hash_column',
        exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'study_sessions'
              and column_name = 'session_token_hash'
        ),
        'study_sessions_user_idempotency_index',
        exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'study_sessions'
              and indexname = 'idx_study_sessions_user_idempotency_key'
        ),
        'study_sessions_anonymous_idempotency_index',
        exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'study_sessions'
              and indexname = 'idx_study_sessions_anonymous_idempotency_key'
        ),
        'anon_cannot_insert_study_sessions',
        not has_table_privilege('anon', 'public.study_sessions', 'INSERT'),
        'authenticated_cannot_insert_study_sessions',
        not has_table_privilege('authenticated', 'public.study_sessions', 'INSERT'),
        'search_terms_trigram_exists',
        exists (
            select 1
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = 'search_terms_trigram'
        ),
        'terms_public_select_granted',
        has_table_privilege('anon', 'public.terms', 'SELECT')
            and has_table_privilege('authenticated', 'public.terms', 'SELECT'),
        'service_role_can_execute_record_study_event',
        has_function_privilege(
            'service_role',
            'public.record_study_event(uuid, text, boolean, integer, text, date, text)',
            'EXECUTE'
        ),
        'authenticated_cannot_execute_record_study_event',
        not has_function_privilege(
            'authenticated',
            'public.record_study_event(uuid, text, boolean, integer, text, date, text)',
            'EXECUTE'
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

revoke all on function public.verify_release_readiness() from public, anon, authenticated;
grant execute on function public.verify_release_readiness() to service_role;
