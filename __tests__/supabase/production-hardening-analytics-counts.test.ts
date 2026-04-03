/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260403110000_production_hardening_analytics_counts.sql'
);

describe('production hardening analytics counts migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('derives session_count from study_sessions in the heatmap function', () => {
        expect(source).toContain('aggregated_sessions as');
        expect(source).toContain('from public.study_sessions as ss');
        expect(source).toContain("coalesce(aggregated_sessions.session_count, 0) as session_count");
    });

    it('stops incrementing daily_learning_logs.session_count per quiz attempt', () => {
        expect(source).toMatch(/v_response_time_ms,\s*0\s*\)/m);
        expect(source).not.toContain('session_count = public.daily_learning_logs.session_count + excluded.session_count');
    });
});
