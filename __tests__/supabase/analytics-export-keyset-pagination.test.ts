/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260408120000_analytics_export_keyset.sql'
);

describe('analytics export keyset pagination migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('uses a stable snapshot and created_at/id keyset cursor', () => {
        expect(source).toContain('qa.created_at <= p_snapshot_created_at');
        expect(source).toContain('qa.created_at < p_last_created_at');
        expect(source).toContain('qa.created_at = p_last_created_at');
        expect(source).toContain('qa.id < p_last_id');
        expect(source).toContain('order by qa.created_at desc, qa.id desc');
    });
});
