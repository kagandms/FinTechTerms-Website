import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_SERVER_SOURCEMAP_PATTERN = /(?:^|[\s/])\.next\/server\/.+?\.map(?:$|\s)/u;

const normalizeEntry = (value) => value.replaceAll('\\', '/').trim();

const collectDirectoryEntries = (directoryPath) => {
    const entries = [];
    const pendingDirectories = [directoryPath];

    while (pendingDirectories.length > 0) {
        const currentDirectory = pendingDirectories.pop();
        if (!currentDirectory) {
            continue;
        }

        for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
            const absolutePath = path.join(currentDirectory, entry.name);

            if (entry.isDirectory()) {
                pendingDirectories.push(absolutePath);
                continue;
            }

            if (entry.isFile()) {
                entries.push(absolutePath);
            }
        }
    }

    return entries;
};

const collectManifestEntries = (inputPath) => {
    const inputStats = fs.statSync(inputPath);

    if (inputStats.isDirectory()) {
        return collectDirectoryEntries(inputPath);
    }

    if (inputStats.isFile()) {
        return fs.readFileSync(inputPath, 'utf8')
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter(Boolean);
    }

    throw new Error(`Unsupported artifact input: ${inputPath}`);
};

const isForbiddenServerSourcemap = (entry) => FORBIDDEN_SERVER_SOURCEMAP_PATTERN.test(normalizeEntry(entry));

const main = () => {
    const inputs = process.argv.slice(2);
    if (inputs.length === 0) {
        throw new Error('Usage: node scripts/guard-artifact-sourcemaps.mjs <manifest-or-directory> [more-inputs...]');
    }

    const forbiddenEntries = inputs.flatMap((input) => (
        collectManifestEntries(path.resolve(process.cwd(), input))
            .filter(isForbiddenServerSourcemap)
            .map(normalizeEntry)
    ));

    if (forbiddenEntries.length > 0) {
        console.error('Forbidden server source maps detected in artifact inputs:');
        for (const entry of forbiddenEntries) {
            console.error(`- ${entry}`);
        }
        process.exit(1);
    }

    console.log('Artifact inputs are free of .next/server source maps.');
};

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
