/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260406100000_public_write_wrapper_restoration.sql'
);

describe('public write wrapper restoration migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('restores public wrapper RPC grants and self-owned idempotency rows', () => {
        expect(source).toContain('grant execute on function public.toggle_my_favorite(text, boolean) to authenticated;');
        expect(source).toContain('grant execute on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text) to authenticated;');
        expect(source).toContain('grant execute on function public.start_study_session(text, text, text, boolean, text, uuid, text) to anon, authenticated;');
        expect(source).toContain('grant execute on function public.bind_study_session_token(uuid, text, text, text) to anon, authenticated;');
        expect(source).toContain('grant execute on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) to anon, authenticated;');
        expect(source).toContain('create policy "Authenticated users can manage own api idempotency keys"');
        expect(source).toContain('grant select, insert, update, delete on public.api_idempotency_keys to authenticated;');
    });

    it('adds atomic favorite-limit helpers and category-count RPC', () => {
        expect(source).toContain('create or replace function public.is_profile_member_complete(');
        expect(source).toContain('create or replace function public.get_user_favorite_limit(');
        expect(source).toContain("raise exception 'Favorite limit reached.'");
        expect(source).toContain('create or replace function public.get_public_term_category_counts()');
    });
});
