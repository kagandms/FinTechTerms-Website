/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260409120000_quiz_occurred_at_window_rejection.sql'
);

describe('quiz occurred_at window rejection migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('rejects client-provided occurred_at values outside the safe replay window', () => {
        expect(source).toContain("v_received_at timestamptz := timezone('utc', now());");
        expect(source).toContain("v_occurred_at timestamptz := v_received_at;");
        expect(source).toContain(
            "if p_occurred_at is not null and p_occurred_at not between v_received_at - interval '12 hours' and v_received_at + interval '5 minutes' then"
        );
        expect(source).toContain("raise exception 'Quiz attempt timestamp is outside the allowed replay window.'");
    });

    it('still uses the accepted occurred_at value for quiz inserts and derived log dates', () => {
        expect(source).toContain("v_effective_log_date := coalesce(p_log_date, timezone('utc', v_occurred_at)::date);");
        expect(source).toContain('v_last_reviewed := v_occurred_at;');
        expect(source).toContain('v_occurred_at,');
    });
});
