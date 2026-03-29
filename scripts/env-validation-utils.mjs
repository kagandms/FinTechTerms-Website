import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER_VALUES = new Set([
    '',
    'your_anon_key_here',
    'your_service_role_key_here',
    'your_study_session_token_secret_here',
    'https://your-domain.example',
    'https://your-project.supabase.co',
    'change_me',
    'admin@example.com',
    'e2e-user@example.com',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KEY_SPECIFIC_REJECTIONS = {
    SUPABASE_SERVICE_ROLE_KEY: new Set(['ci-service-role-key']),
    STUDY_SESSION_TOKEN_SECRET: new Set(['ci-study-session-token-secret']),
    OPENROUTER_API_KEY: new Set(['ci-openrouter-key']),
    UPSTASH_REDIS_REST_TOKEN: new Set(['ci-upstash-token']),
    ADMIN_USER_IDS: new Set(['ci-admin-user']),
    NEXT_PUBLIC_SENTRY_DSN: new Set(['https://examplePublicKey@o0.ingest.sentry.io/0']),
    UPSTASH_REDIS_REST_URL: new Set(['https://example.upstash.io']),
};

const candidateFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
];

export const loadLocalEnv = () => {
    for (const candidateFile of candidateFiles) {
        if (!fs.existsSync(candidateFile)) {
            continue;
        }

        const content = fs.readFileSync(candidateFile, 'utf8');
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) {
                continue;
            }

            const separatorIndex = line.indexOf('=');
            if (separatorIndex === -1) {
                continue;
            }

            const key = line.slice(0, separatorIndex).trim();
            if (!key || process.env[key]) {
                continue;
            }

            const rawValue = line.slice(separatorIndex + 1).trim();
            process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
        }
    }
};

const validateUrl = (value) => {
    try {
        const parsed = new URL(value);
        return ['http:', 'https:', 'postgres:', 'postgresql:'].includes(parsed.protocol) && Boolean(parsed.host);
    } catch {
        return false;
    }
};

const hasPlaceholderHost = (value) => {
    try {
        const { hostname } = new URL(value);
        return hostname.includes('example');
    } catch {
        return false;
    }
};

const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validateUuidList = (value) => {
    const entries = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    return entries.length > 0 && entries.every((entry) => UUID_PATTERN.test(entry));
};

const validateModelList = (value) => value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .every((entry) => entry.includes('/'));

const validateSemanticValue = (key, value) => {
    const rejectedValues = KEY_SPECIFIC_REJECTIONS[key];
    if (rejectedValues?.has(value)) {
        return `${key}: placeholder-like CI sentinel`;
    }

    if ((key.endsWith('_URL') || key.endsWith('_DSN')) && hasPlaceholderHost(value)) {
        return `${key}: placeholder-like host`;
    }

    if (key === 'NEXT_PUBLIC_SUPABASE_URL' && !new URL(value).hostname.endsWith('.supabase.co')) {
        return `${key}: expected a Supabase project host`;
    }

    if (key === 'ADMIN_USER_IDS' && !validateUuidList(value)) {
        return `${key}: expected one or more comma-separated UUIDs`;
    }

    if ((key === 'E2E_AUTH_EMAIL' || key === 'SENTRY_SMOKE_EMAIL') && !validateEmail(value)) {
        return `${key}: invalid email`;
    }

    if ((key === 'E2E_AUTH_EMAIL' || key === 'SENTRY_SMOKE_EMAIL') && value.endsWith('@example.com')) {
        return `${key}: placeholder email`;
    }

    if (key === 'E2E_AUTH_PASSWORD' || key === 'SENTRY_SMOKE_PASSWORD') {
        if (value.length < 8 || value === 'change_me') {
            return `${key}: password is too weak`;
        }
    }

    if (key === 'AI_PRIMARY_MODEL' && !value.includes('/')) {
        return `${key}: expected provider/model format`;
    }

    if (key === 'AI_FALLBACK_MODELS' && !validateModelList(value)) {
        return `${key}: expected comma-separated provider/model values`;
    }

    if (
        key === 'SUPABASE_SERVICE_ROLE_KEY'
        || key === 'STUDY_SESSION_TOKEN_SECRET'
        || key === 'OPENROUTER_API_KEY'
        || key === 'UPSTASH_REDIS_REST_TOKEN'
    ) {
        if (value.length < 24) {
            return `${key}: secret is too short`;
        }
    }

    if (key === 'NEXT_PUBLIC_SENTRY_DSN' && value.includes('examplePublicKey')) {
        return `${key}: placeholder DSN`;
    }

    return null;
};

export const runValidation = (requiredKeys) => {
    loadLocalEnv();

    const failures = [];

    for (const key of requiredKeys) {
        const value = process.env[key]?.trim() ?? '';

        if (!value || PLACEHOLDER_VALUES.has(value)) {
            failures.push(`${key}: missing or placeholder`);
            continue;
        }

        if (key.endsWith('_URL') || key.endsWith('_DSN')) {
            if (!validateUrl(value)) {
                failures.push(`${key}: invalid URL`);
                continue;
            }
        }

        const semanticFailure = validateSemanticValue(key, value);
        if (semanticFailure) {
            failures.push(semanticFailure);
        }
    }

    if (failures.length > 0) {
        console.error(JSON.stringify({
            ok: false,
            failures,
        }, null, 2));
        process.exit(1);
    }

    console.log(JSON.stringify({
        ok: true,
        validatedKeys: requiredKeys,
    }, null, 2));
};
