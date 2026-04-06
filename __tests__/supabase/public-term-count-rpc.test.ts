/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260406140000_public_term_count_rpc.sql'
);

describe('public term count rpc migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('adds a public aggregate rpc for term counts', () => {
        expect(source).toContain('create or replace function public.get_public_term_count()');
        expect(source).toContain('select count(*)::bigint');
        expect(source).toContain("where terms.is_academic is distinct from false");
        expect(source).toContain('grant execute on function public.get_public_term_count() to anon, authenticated, service_role;');
    });
});
