/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260421100000_request_scoped_write_boundary_restoration.sql'
);

describe('request-scoped write boundary restoration migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('restores the public write wrapper grants with the latest signatures', () => {
        expect(source).toContain('grant execute on function public.toggle_my_favorite(text, boolean) to authenticated;');
        expect(source).toContain('grant execute on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz) to authenticated;');
        expect(source).toContain('grant execute on function public.start_study_session(text, text, text, boolean, text, uuid, text) to anon, authenticated;');
        expect(source).toContain('grant execute on function public.bind_study_session_token(uuid, text, text, text) to anon, authenticated;');
        expect(source).toContain('grant execute on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) to anon, authenticated;');
    });

    it('restores authenticated ownership of durable API idempotency rows', () => {
        expect(source).toContain('create policy "Authenticated users can manage own api idempotency keys"');
        expect(source).toContain('using (auth.uid() = user_id)');
        expect(source).toContain('with check (auth.uid() = user_id);');
        expect(source).toContain('grant select, insert, update, delete on public.api_idempotency_keys to authenticated;');
    });
});
