/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260406120000_route_only_write_boundary_reinstatement.sql'
);

describe('route-only write boundary reinstatement migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('revokes browser-accessible write RPC grants after the public wrapper rollback', () => {
        expect(source).toContain(
            'revoke all on function public.toggle_my_favorite(text, boolean) from public, anon, authenticated;'
        );
        expect(source).toContain(
            'revoke all on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz) from public, anon, authenticated;'
        );
        expect(source).toContain(
            'revoke all on function public.start_study_session(text, text, text, boolean, text, uuid, text) from public, anon, authenticated;'
        );
        expect(source).toContain(
            'revoke all on function public.bind_study_session_token(uuid, text, text, text) from public, anon, authenticated;'
        );
        expect(source).toContain(
            'revoke all on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) from public, anon, authenticated;'
        );
    });

    it('locks api idempotency rows back to the trusted server boundary', () => {
        expect(source).toContain(
            'drop policy if exists "Authenticated users can manage own api idempotency keys" on public.api_idempotency_keys;'
        );
        expect(source).toContain('revoke all on public.api_idempotency_keys from public, anon, authenticated;');
    });
});
