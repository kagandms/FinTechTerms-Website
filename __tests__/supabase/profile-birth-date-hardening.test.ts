/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260405110000_profile_birth_date_hardening.sql'
);

describe('profile birth-date hardening migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('nulls invalid persisted profile birth dates', () => {
        expect(source).toContain('update public.profiles');
        expect(source).toContain('set birth_date = null');
        expect(source).toContain("birth_date > timezone('utc', now())::date");
        expect(source).toContain("birth_date > (timezone('utc', now())::date - interval '13 years')::date");
        expect(source).toContain("birth_date < (timezone('utc', now())::date - interval '120 years')::date");
    });
});
