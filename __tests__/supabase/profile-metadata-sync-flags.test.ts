/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260409130000_profile_metadata_sync_flags.sql'
);

describe('profile metadata sync flags migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('adds durable metadata sync reconciliation columns to profiles', () => {
        expect(source).toContain('alter table public.profiles');
        expect(source).toContain('add column if not exists metadata_sync_pending boolean not null default false');
        expect(source).toContain('add column if not exists metadata_sync_attempted_at timestamptz');
        expect(source).toContain('add column if not exists metadata_synced_at timestamptz');
        expect(source).toContain('add column if not exists metadata_sync_error text');
    });
});
