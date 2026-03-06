# Dev Notes

## Minor Issues Encountered

1. `next build` initially failed in [app/api/record-quiz/route.ts](/Users/kagansmtdms/Downloads/Projects/FinTechTerms-Website/app/api/record-quiz/route.ts) because the generated Supabase types require `quiz_attempts.user_id` to be a non-null string while the route still attempted to insert `null`. I resolved this by returning a `400 VALIDATION_ERROR` when `user_id` is missing instead of coercing the insert payload.

2. `next build` then failed in [app/api/telegram/link/route.ts](/Users/kagansmtdms/Downloads/Projects/FinTechTerms-Website/app/api/telegram/link/route.ts) because the generated TypeScript schema in [types/supabase.ts](/Users/kagansmtdms/Downloads/Projects/FinTechTerms-Website/types/supabase.ts) does not currently include the `telegram_users` table. I avoided blocking the route by using an untyped route-local Supabase client in that file only, while keeping the rest of the route logic typed.

3. `next build` emits a non-blocking workspace warning because Next.js detects multiple lockfiles and infers `/Users/kagansmtdms` as the workspace root. The build still completes successfully, but this warning should be removed later by setting `outputFileTracingRoot` or cleaning up the extra lockfile layout.

4. The repository already contained unrelated local modifications in several overlapping files when execution started. I preserved all existing work and layered the requested changes on top without reverting user edits.
