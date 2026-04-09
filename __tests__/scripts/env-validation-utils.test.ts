/**
 * @jest-environment node
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const runtimeValidationScriptSource = fs.readFileSync(
    path.join(process.cwd(), 'scripts/validate-runtime-env.mjs'),
    'utf8'
);
const envValidationUtilsSource = fs.readFileSync(
    path.join(process.cwd(), 'scripts/env-validation-utils.mjs'),
    'utf8'
);

const VALID_RUNTIME_ENV = {
    NEXT_PUBLIC_SITE_URL: 'https://app.fintechterms.dev',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-0123456789abcdefghijklmnop',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-0123456789abcdefghijklmnop',
    STUDY_SESSION_TOKEN_SECRET: 'study-session-secret-0123456789abcdefghijklmnop',
    OPENROUTER_API_KEY: 'openrouter-key-0123456789abcdefghijklmnop',
    AI_PRIMARY_MODEL: 'openai/gpt-5.4-mini',
    AI_FALLBACK_MODELS: 'openai/gpt-5.4-mini,deepseek/deepseek-chat-v3.1',
    ADMIN_USER_IDS: '7131322b-644f-494a-b3af-4e1d09863e47',
    UPSTASH_REDIS_REST_URL: 'https://redis.fintechterms.dev',
    UPSTASH_REDIS_REST_TOKEN: 'upstash-token-0123456789abcdefghijklmnop',
    NEXT_PUBLIC_SENTRY_DSN: 'https://public@o1.ingest.sentry.io/123456',
};

describe('env validation local-env policy', () => {
    const createTempScriptWorkspace = (): string => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ftt-env-validation-'));
        const scriptsDir = path.join(tempDir, 'scripts');
        fs.mkdirSync(scriptsDir, { recursive: true });
        fs.writeFileSync(path.join(scriptsDir, 'validate-runtime-env.mjs'), runtimeValidationScriptSource);
        fs.writeFileSync(path.join(scriptsDir, 'env-validation-utils.mjs'), envValidationUtilsSource);
        return tempDir;
    };

    const writeLocalEnvFile = (workspaceDir: string): void => {
        const lines = Object.entries(VALID_RUNTIME_ENV)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        fs.writeFileSync(path.join(workspaceDir, '.env.local'), `${lines}\n`);
    };

    it('ignores .env.local by default during runtime validation', () => {
        const workspaceDir = createTempScriptWorkspace();
        writeLocalEnvFile(workspaceDir);

        expect(() => {
            execFileSync(process.execPath, ['scripts/validate-runtime-env.mjs'], {
                cwd: workspaceDir,
                env: {
                    ...process.env,
                },
                stdio: 'pipe',
            });
        }).toThrow();
    });

    it('allows explicit local-env dry runs with ALLOW_LOCAL_ENV_VALIDATION=1', () => {
        const workspaceDir = createTempScriptWorkspace();
        writeLocalEnvFile(workspaceDir);

        const output = execFileSync(process.execPath, ['scripts/validate-runtime-env.mjs'], {
            cwd: workspaceDir,
            env: {
                ...process.env,
                ALLOW_LOCAL_ENV_VALIDATION: '1',
            },
            encoding: 'utf8',
            stdio: 'pipe',
        });

        expect(output).toContain('"ok": true');
    });
});
