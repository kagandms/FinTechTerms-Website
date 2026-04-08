/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260408110000_session_token_possession_shutdown.sql'
);

describe('session token possession shutdown migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('keeps token-hash ownership checks without requiring requester_user_id equality', () => {
        expect(source).toContain('v_session.session_token_hash is distinct from p_session_token_hash');
        expect(source).not.toContain('p_requester_user_id is distinct from v_session.user_id');
    });
});
