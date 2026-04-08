/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260408130000_study_only_heatmap_semantics.sql'
);

describe('study-only heatmap semantics migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('keeps session_count visible but removes it from activity_count', () => {
        expect(source).toContain("coalesce(aggregated_sessions.session_count, 0) as session_count");
        expect(source).toContain('coalesce(aggregated_logs.words_reviewed, 0)::integer as activity_count');
        expect(source).not.toContain('+ greatest(coalesce(aggregated_sessions.session_count, 0), 0)');
    });

    it('adds an index for user/session_start heatmap access', () => {
        expect(source).toContain('create index if not exists idx_study_sessions_user_session_start_desc');
        expect(source).toContain('on public.study_sessions (user_id, session_start desc)');
    });
});
