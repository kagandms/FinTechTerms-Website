/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260405120000_learning_metric_semantics.sql'
);

describe('learning metric semantics migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('stops double counting first-correct reviews in activity_count', () => {
        expect(source).toContain(
            "coalesce(aggregated_logs.words_reviewed, 0)\n            + greatest(coalesce(aggregated_sessions.session_count, 0), 0)"
        );
        expect(source).not.toContain("+ coalesce(aggregated_logs.new_words_learned, 0)");
    });

    it('derives retention_rate from empirical correctness history', () => {
        expect(source).toContain('v_times_reviewed := coalesce(v_existing_srs.times_reviewed, 0) + 1;');
        expect(source).toContain('v_times_correct := coalesce(v_existing_srs.times_correct, 0) + case when p_is_correct then 1 else 0 end;');
        expect(source).toContain('v_new_retention := case');
        expect(source).toContain('round((v_times_correct::numeric / v_times_reviewed::numeric), 2)');
    });
});
