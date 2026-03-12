import { createClient } from '@supabase/supabase-js';

const requiredEnv = (name) => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

const projectUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
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

const checks = data?.checks ?? {};
const failedChecks = Object.entries(checks).filter(([, passed]) => passed !== true);

console.log(JSON.stringify({
    ok: failedChecks.length === 0,
    checks,
}, null, 2));

if (!data?.ok || failedChecks.length > 0) {
    process.exit(1);
}
