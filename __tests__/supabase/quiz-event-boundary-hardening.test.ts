/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260407100000_quiz_event_boundary_hardening.sql'
);

describe('quiz event boundary hardening migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('bounds client-provided occurred_at values to a safe replay window', () => {
        expect(source).toContain("v_received_at timestamptz := timezone('utc', now());");
        expect(source).toContain("v_occurred_at timestamptz := v_received_at;");
        expect(source).toContain(
            "if p_occurred_at between v_received_at - interval '12 hours' and v_received_at + interval '5 minutes' then"
        );
        expect(source).toContain('v_occurred_at := p_occurred_at;');
    });

    it('keeps using the normalized occurred_at value for quiz inserts and derived log dates', () => {
        expect(source).toContain("v_effective_log_date := coalesce(p_log_date, timezone('utc', v_occurred_at)::date);");
        expect(source).toContain('v_last_reviewed := v_occurred_at;');
        expect(source).toContain('v_occurred_at,');
    });
});
