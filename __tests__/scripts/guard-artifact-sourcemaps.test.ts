/**
 * @jest-environment node
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const scriptPath = path.join(process.cwd(), 'scripts/guard-artifact-sourcemaps.mjs');
const pruneScriptPath = path.join(process.cwd(), 'scripts/prune-server-sourcemaps.mjs');

const createTempDirectory = (): string => (
    fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-guard-'))
);

describe('guard-artifact-sourcemaps', () => {
    it('fails when a manifest includes Next.js server sourcemaps', () => {
        const tempDirectory = createTempDirectory();
        const manifestPath = path.join(tempDirectory, 'artifact.manifest');

        fs.writeFileSync(manifestPath, [
            'public/sw.js',
            '.next/static/chunks/app.js',
            '.next/server/app/dashboard/page.js.map',
        ].join('\n'));

        expect(() => {
            execFileSync('node', [scriptPath, manifestPath], {
                cwd: process.cwd(),
                stdio: 'pipe',
            });
        }).toThrow(/Forbidden server source maps detected/u);
    });

    it('passes for a safe artifact directory', () => {
        const tempDirectory = createTempDirectory();
        fs.mkdirSync(path.join(tempDirectory, 'public'), { recursive: true });
        fs.mkdirSync(path.join(tempDirectory, '.next/static/chunks'), { recursive: true });
        fs.writeFileSync(path.join(tempDirectory, 'public/sw.js'), 'self.addEventListener("install", () => {});');
        fs.writeFileSync(path.join(tempDirectory, '.next/static/chunks/app.js'), 'console.log("safe");');

        expect(() => {
            execFileSync('node', [scriptPath, tempDirectory], {
                cwd: process.cwd(),
                stdio: 'pipe',
            });
        }).not.toThrow();
    });

    it('prunes only Next.js server sourcemaps from build output', () => {
        const tempDirectory = createTempDirectory();
        const serverMapPath = path.join(tempDirectory, '.next/server/app/dashboard/page.js.map');
        const clientMapPath = path.join(tempDirectory, '.next/static/chunks/app.js.map');

        fs.mkdirSync(path.dirname(serverMapPath), { recursive: true });
        fs.mkdirSync(path.dirname(clientMapPath), { recursive: true });
        fs.writeFileSync(serverMapPath, '{}');
        fs.writeFileSync(clientMapPath, '{}');

        execFileSync('node', [pruneScriptPath], {
            cwd: tempDirectory,
            stdio: 'pipe',
        });

        expect(fs.existsSync(serverMapPath)).toBe(false);
        expect(fs.existsSync(clientMapPath)).toBe(true);
    });
});
