/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260424120000_record_study_event_member_guard.sql'
);

describe('record study event member guard migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('requires member-complete profile state inside the authenticated wrapper', () => {
        expect(source).toContain('create or replace function public.record_my_study_event(');
        expect(source).toContain('v_user_id uuid := auth.uid();');
        expect(source).toContain('if not public.is_profile_member_complete(v_user_id) then');
        expect(source).toContain("raise exception 'Complete your member setup to unlock review mode.'");
        expect(source).toContain("using errcode = '42501';");
    });

    it('keeps the wrapper executable only by authenticated callers', () => {
        expect(source).toContain(
            'revoke all on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz) from public, anon;'
        );
        expect(source).toContain(
            'grant execute on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz) to authenticated;'
        );
    });
});
