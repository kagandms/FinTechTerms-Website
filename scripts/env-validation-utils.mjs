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
            }
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
