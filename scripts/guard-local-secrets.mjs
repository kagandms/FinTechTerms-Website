import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const FORBIDDEN_LOCAL_SECRET_FILES = [
    '.env.local',
    'telegram-bot/.env',
];

const isTrackedNonExampleEnvFile = (filePath) => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileName = path.posix.basename(normalizedPath);

    if (!fileName.startsWith('.env')) {
        return false;
    }

    return !fileName.endsWith('.example');
};

const listTrackedFiles = (rootDir) => {
    try {
        return execFileSync('git', ['ls-files', '-z'], {
            cwd: rootDir,
            encoding: 'utf8',
        })
            .split('\0')
            .filter(Boolean);
    } catch (error) {
        throw new Error(
            `Unable to enumerate tracked files for secret guard: ${error instanceof Error ? error.message : 'Unknown git failure.'}`
        );
    }
};

const walkDirectory = (directoryPath) => {
    if (!fs.existsSync(directoryPath)) {
        return [];
    }

    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    const discoveredFiles = [];

    for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            discoveredFiles.push(...walkDirectory(entryPath));
            continue;
        }

        discoveredFiles.push(entryPath);
    }

    return discoveredFiles;
};

export const findPresentLocalSecretFiles = (rootDir) => {
    const forbiddenFiles = FORBIDDEN_LOCAL_SECRET_FILES
        .map((relativePath) => path.join(rootDir, relativePath))
        .filter((absolutePath) => fs.existsSync(absolutePath))
        .map((absolutePath) => path.relative(rootDir, absolutePath));

    const vercelEnvFiles = walkDirectory(path.join(rootDir, '.vercel'))
        .map((absolutePath) => path.relative(rootDir, absolutePath))
        .filter((relativePath) => path.basename(relativePath).startsWith('.env'));

    return [...forbiddenFiles, ...vercelEnvFiles]
        .map((relativePath) => relativePath.replace(/\\/g, '/'))
        .sort();
};

export const findTrackedNonExampleEnvFiles = (rootDir) => (
    listTrackedFiles(rootDir)
        .filter(isTrackedNonExampleEnvFile)
        .map((relativePath) => relativePath.replace(/\\/g, '/'))
        .sort()
);

export const runLocalSecretGuard = (rootDir = process.cwd()) => {
    const presentLocalSecretFiles = findPresentLocalSecretFiles(rootDir);
    const trackedNonExampleEnvFiles = findTrackedNonExampleEnvFiles(rootDir);

    if (presentLocalSecretFiles.length === 0 && trackedNonExampleEnvFiles.length === 0) {
        console.log(JSON.stringify({
            ok: true,
        }, null, 2));
        return;
    }

    console.error(JSON.stringify({
        ok: false,
        presentLocalSecretFiles,
        trackedNonExampleEnvFiles,
    }, null, 2));
    process.exit(1);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runLocalSecretGuard();
}
