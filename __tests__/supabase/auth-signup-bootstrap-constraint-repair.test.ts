/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260422123000_auth_signup_bootstrap_constraint_repair.sql'
);

const releaseDbVerificationScriptPath = path.join(
    process.cwd(),
    'scripts/verify-release-db.mjs'
);

describe('auth signup bootstrap constraint repair migration', () => {
    const migrationSource = fs.readFileSync(migrationPath, 'utf8');
    const verificationSource = fs.readFileSync(releaseDbVerificationScriptPath, 'utf8');

    it('removes the legacy user_progress id foreign key that breaks auth inserts', () => {
        expect(migrationSource).toContain('alter table public.user_progress');
        expect(migrationSource).toContain('drop constraint if exists user_progress_id_fkey');
    });

    it('adds release checks for auth signup bootstrap invariants', () => {
        expect(migrationSource).toContain('verify_auth_signup_bootstrap_readiness');
        expect(migrationSource).toContain('user_progress_id_not_auth_user_fk');
        expect(migrationSource).toContain('auth_user_bootstrap_trigger_enabled');
        expect(migrationSource).toContain('auth_user_profile_trigger_enabled');
        expect(verificationSource).toContain('verify_auth_signup_bootstrap_readiness');
        expect(verificationSource).toContain('authBootstrapChecks');
    });
});
