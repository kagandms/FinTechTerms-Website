/**
 * @jest-environment node
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

describe('guard local secrets script', () => {
    const createTempRepo = (): string => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ftt-secret-guard-'));
        execFileSync('git', ['init'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
        return tempDir;
    };

    it('detects present forbidden local secret files', async () => {
        const tempDir = createTempRepo();
        fs.writeFileSync(path.join(tempDir, '.env.local'), 'SECRET=value');
        fs.mkdirSync(path.join(tempDir, 'telegram-bot'), { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'telegram-bot/.env'), 'BOT_TOKEN=value');

        const { findPresentLocalSecretFiles } = await import('@/scripts/guard-local-secrets.mjs');

        expect(findPresentLocalSecretFiles(tempDir)).toEqual([
            '.env.local',
            'telegram-bot/.env',
        ]);
    });

    it('detects tracked non-example env files', async () => {
        const tempDir = createTempRepo();
        fs.writeFileSync(path.join(tempDir, '.env.production'), 'SHOULD_NOT_BE_TRACKED=value');
        fs.writeFileSync(path.join(tempDir, '.env.example'), 'PLACEHOLDER=value');
        execFileSync('git', ['add', '.'], { cwd: tempDir });

        const { findTrackedNonExampleEnvFiles } = await import('@/scripts/guard-local-secrets.mjs');

        expect(findTrackedNonExampleEnvFiles(tempDir)).toEqual([
            '.env.production',
        ]);
    });
});
