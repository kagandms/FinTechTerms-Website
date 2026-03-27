/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260327120000_route_trust_boundary_reduction.sql'
);

describe('route trust-boundary reduction migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('keeps api idempotency rows self-owned for authenticated users', () => {
        expect(source).toContain('create policy "Authenticated users can manage own api idempotency keys"');
        expect(source).toContain('using (auth.uid() = user_id)');
        expect(source).toContain('with check (auth.uid() = user_id)');
    });

    it('binds favorite and quiz wrappers to auth.uid instead of caller-supplied user ids', () => {
        expect(source).toMatch(
            /create or replace function public\.toggle_my_favorite[\s\S]*v_user_id uuid := auth\.uid\(\);[\s\S]*return public\.toggle_user_favorite\(v_user_id, p_term_id, p_should_favorite\);/m
        );
        expect(source).toMatch(
            /create or replace function public\.record_my_study_event[\s\S]*v_user_id uuid := auth\.uid\(\);[\s\S]*return public\.record_study_event\(\s*v_user_id,\s*p_term_id,\s*p_is_correct,/m
        );
    });

    it('keeps study-session follow-up writes token-hash and ownership gated in SQL', () => {
        expect(source).toMatch(
            /create or replace function public\.bind_study_session_token[\s\S]*v_user_id uuid := auth\.uid\(\);/m
        );
        expect(source).toMatch(
            /create or replace function public\.update_study_session_by_token[\s\S]*v_user_id uuid := auth\.uid\(\);/m
        );
        expect(source).toContain('v_session.session_token_hash is distinct from p_session_token_hash');
        expect(source).toContain('if v_user_id is distinct from v_session.user_id then');
        expect(source).toContain("elsif v_user_id is not null then");
    });
});
