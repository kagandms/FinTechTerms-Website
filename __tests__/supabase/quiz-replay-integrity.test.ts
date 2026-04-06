/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260406110000_quiz_replay_integrity.sql'
);

describe('quiz replay integrity migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('adds occurred_at to the quiz write function signatures', () => {
        expect(source).toContain('p_occurred_at timestamptz default null');
        expect(source).toContain(
            'public.record_study_event(uuid, text, boolean, integer, text, date, text, uuid, text, timestamptz)'
        );
        expect(source).toContain(
            'public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz)'
        );
    });

    it('uses occurred_at to drive attempt timestamp, review timestamp, and effective log date', () => {
        expect(source).toContain("v_occurred_at timestamptz := coalesce(p_occurred_at, timezone('utc', now()));");
        expect(source).toContain('v_last_reviewed timestamptz := v_occurred_at;');
        expect(source).toContain("v_effective_log_date date := coalesce(p_log_date, timezone('utc', v_occurred_at)::date);");
        expect(source).toContain('created_at,');
        expect(source).toContain('v_occurred_at,');
    });

    it('updates release readiness to the occurred_at-aware record_study_event signature', () => {
        expect(source).toContain(
            "'public.record_study_event(uuid, text, boolean, integer, text, date, text, uuid, text, timestamptz)'"
        );
    });
});
