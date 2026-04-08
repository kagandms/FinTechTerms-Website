/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260408140000_favorites_server_write_wrapper.sql'
);

describe('favorites server write wrapper migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('adds a service-role-only favorite wrapper with member-limit enforcement', () => {
        expect(source).toContain('create or replace function public.toggle_my_favorite_server(');
        expect(source).toContain("if v_request_role <> 'service_role' then");
        expect(source).toContain('v_favorite_limit := public.get_user_favorite_limit(p_user_id);');
        expect(source).toContain("raise exception 'Favorite limit reached.'");
        expect(source).toContain('return public.toggle_user_favorite(p_user_id, p_term_id, p_should_favorite);');
        expect(source).toContain('grant execute on function public.toggle_my_favorite_server(uuid, text, boolean) to service_role;');
    });
});
