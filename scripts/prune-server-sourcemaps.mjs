import fs from 'node:fs';
import path from 'node:path';

const SERVER_OUTPUT_DIRECTORY = path.join(process.cwd(), '.next', 'server');

const collectServerSourcemaps = (directoryPath) => {
    if (!fs.existsSync(directoryPath)) {
        return [];
    }

    const discoveredFiles = [];
    const pendingDirectories = [directoryPath];

    while (pendingDirectories.length > 0) {
        const currentDirectory = pendingDirectories.pop();

        if (!currentDirectory) {
            continue;
        }

        for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
            const entryPath = path.join(currentDirectory, entry.name);

            if (entry.isDirectory()) {
                pendingDirectories.push(entryPath);
                continue;
            }

            if (entry.isFile() && entry.name.endsWith('.map')) {
                discoveredFiles.push(entryPath);
            }
        }
    }

    return discoveredFiles.sort();
};

const pruneServerSourcemaps = () => {
    const sourcemapPaths = collectServerSourcemaps(SERVER_OUTPUT_DIRECTORY);

    for (const sourcemapPath of sourcemapPaths) {
        fs.rmSync(sourcemapPath, { force: true });
    }

    return sourcemapPaths.length;
};

const main = () => {
    const removedCount = pruneServerSourcemaps();

    console.log(JSON.stringify({
        ok: true,
        removedServerSourcemaps: removedCount,
    }, null, 2));
};

main();
