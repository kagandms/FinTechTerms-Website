/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260329110000_production_readiness_session_link_and_utc_dates.sql'
);

describe('production readiness session-link and UTC date migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('binds durable quiz attempts to study sessions with token-hash validation', () => {
        expect(source).toContain('p_session_id uuid default null');
        expect(source).toContain('p_session_token_hash text default null');
        expect(source).toContain('v_session.session_token_hash is distinct from p_session_token_hash');
        expect(source).toContain('session_id = v_effective_session_id');
        expect(source).toContain('where session_id = v_effective_session_id');
    });

    it('moves daily log defaults and heatmap windows to UTC calendar dates', () => {
        expect(source).toContain("alter table public.daily_learning_logs");
        expect(source).toContain("timezone('utc', now())::date");
        expect(source).toContain("create or replace function public.get_user_learning_heatmap()");
    });

    it('updates release readiness to the new record_study_event signature', () => {
        expect(source).toContain(
            "'public.record_study_event(uuid, text, boolean, integer, text, date, text, uuid, text)'"
        );
        expect(source).toContain("'quiz_attempts_session_id_column'");
    });
});
