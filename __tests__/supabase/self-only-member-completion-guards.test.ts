/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260406130000_self_only_member_completion_guards.sql'
);

describe('self-only member completion guard migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('restricts authenticated callers to their own profile-completion lookups', () => {
        expect(source).toContain("v_request_role <> 'service_role'");
        expect(source).toContain('v_caller_user_id is distinct from v_target_user_id');
        expect(source).toContain("raise exception 'Access denied.'");
        expect(source).toContain('select birth_date');
    });

    it('applies the same self-only guard to favorite-limit lookups', () => {
        expect(source).toContain('create or replace function public.get_user_favorite_limit(');
        expect(source).toContain("if public.is_profile_member_complete(v_target_user_id) then");
        expect(source).toContain('return 2147483647;');
        expect(source).toContain('return 15;');
    });
});
