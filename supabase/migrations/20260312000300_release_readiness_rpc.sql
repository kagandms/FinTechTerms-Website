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
