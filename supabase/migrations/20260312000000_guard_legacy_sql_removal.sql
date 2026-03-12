-- Guard migration: assert that no permissive anonymous policies exist on study_sessions.
-- If this migration fails, the legacy SQL was applied after the lockdown migration.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'study_sessions'
          AND cmd IN ('INSERT', 'ALL')
          AND (
              coalesce(with_check, '') ILIKE '%true%'
              OR coalesce(qual, '') ILIKE '%anonymous_id IS NOT NULL%'
          )
          AND policyname <> 'Service role can manage study sessions'
    ) THEN
        RAISE EXCEPTION
            'Legacy permissive RLS policy detected on public.study_sessions. Remove archived lib/study_sessions_schema.sql usage before continuing.';
    END IF;
END $$;
