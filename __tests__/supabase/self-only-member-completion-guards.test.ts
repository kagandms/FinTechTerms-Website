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
    });

    it('requires full name, auth email, and accepted birth date for member completion', () => {
        expect(source).toContain('v_full_name text;');
        expect(source).toContain('v_email text;');
        expect(source).toContain('select full_name, birth_date');
        expect(source).toContain('from public.profiles');
        expect(source).toContain('select email');
        expect(source).toContain('from auth.users');
        expect(source).toContain("nullif(btrim(v_full_name), '') is null");
        expect(source).toContain("array_length(regexp_split_to_array(btrim(v_full_name), '[[:space:]]+'), 1) < 2");
        expect(source).toContain("nullif(btrim(v_email), '') is null");
    });

    it('applies the same self-only guard to favorite-limit lookups', () => {
        expect(source).toContain('create or replace function public.get_user_favorite_limit(');
        expect(source).toContain("if public.is_profile_member_complete(v_target_user_id) then");
        expect(source).toContain('return 2147483647;');
        expect(source).toContain('return 15;');
    });
});
