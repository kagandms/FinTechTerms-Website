import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loadLocalEnv } from './env-validation-utils.mjs';

loadLocalEnv();

const requiredEnv = (name) => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

const validateProjectUrl = (value) => {
    try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.host) {
            throw new Error('URL must be absolute http(s).');
        }
    } catch (error) {
        throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${error instanceof Error ? error.message : 'Malformed URL.'}`);
    }
};

const projectUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
validateProjectUrl(projectUrl);
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(projectUrl, serviceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

const { data, error } = await supabaseAdmin.rpc('verify_release_readiness');

if (error) {
    console.error(JSON.stringify({
        ok: false,
        error: error.message,
    }, null, 2));
    process.exit(1);
}

const { data: authBootstrapData, error: authBootstrapError } = await supabaseAdmin.rpc(
    'verify_auth_signup_bootstrap_readiness'
);

if (authBootstrapError) {
    console.error(JSON.stringify({
        ok: false,
        error: authBootstrapError.message,
    }, null, 2));
    process.exit(1);
}

const checks = data?.checks ?? {};
const failedChecks = Object.entries(checks).filter(([, passed]) => passed !== true);
const authBootstrapChecks = authBootstrapData?.checks ?? {};
const failedAuthBootstrapChecks = Object.entries(authBootstrapChecks)
    .filter(([, passed]) => passed !== true);
let termMirror = { ok: false, error: 'Term mirror verification did not run.' };

try {
    const rawOutput = execFileSync(
        process.execPath,
        [path.resolve(process.cwd(), 'scripts/verify_terms.js')],
        {
            encoding: 'utf8',
            stdio: 'pipe',
        }
    );
    termMirror = JSON.parse(rawOutput);
} catch (error) {
    const stderr = error instanceof Error && 'stderr' in error
        ? String(error.stderr || '')
        : '';
    const stdout = error instanceof Error && 'stdout' in error
        ? String(error.stdout || '')
        : '';
    const candidateOutput = stderr.trim() || stdout.trim();

    try {
        termMirror = candidateOutput
            ? JSON.parse(candidateOutput)
            : { ok: false, error: error instanceof Error ? error.message : 'Unknown term mirror verification failure.' };
    } catch {
        termMirror = {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown term mirror verification failure.',
        };
    }
}

console.log(JSON.stringify({
    ok: failedChecks.length === 0
        && failedAuthBootstrapChecks.length === 0
        && termMirror.ok === true,
    checks,
    authBootstrapChecks,
    termMirror,
}, null, 2));

if (
    !data?.ok
    || !authBootstrapData?.ok
    || failedChecks.length > 0
    || failedAuthBootstrapChecks.length > 0
    || termMirror.ok !== true
) {
    process.exit(1);
}
