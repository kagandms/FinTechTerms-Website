import fs from 'node:fs';
import path from 'node:path';

const forbiddenPatterns = [
    /lib\/.+\.sql/g,
    /telegram-bot\/migrations\//g,
];

const candidateFiles = [
    path.resolve(process.cwd(), 'package.json'),
    path.resolve(process.cwd(), '.github/workflows'),
    path.resolve(process.cwd(), 'scripts'),
];

const collectFiles = (candidatePath) => {
    if (!fs.existsSync(candidatePath)) {
        return [];
    }

    const stats = fs.statSync(candidatePath);
    if (stats.isFile()) {
        return [candidatePath];
    }

    if (!stats.isDirectory()) {
        return [];
    }

    return fs.readdirSync(candidatePath, { withFileTypes: true }).flatMap((entry) => {
        if (entry.name.startsWith('.')) {
            return [];
        }

        const absolutePath = path.join(candidatePath, entry.name);
        return entry.isDirectory() ? collectFiles(absolutePath) : [absolutePath];
    });
};

const violations = [];

for (const filePath of candidateFiles.flatMap(collectFiles)) {
    const relativePath = path.relative(process.cwd(), filePath);
    if (relativePath === 'scripts/verify-sql-sources.mjs') {
        continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');

    for (const pattern of forbiddenPatterns) {
        const matches = content.match(pattern);
        if (!matches || matches.length === 0) {
            continue;
        }

        violations.push({
            file: relativePath,
            matches: Array.from(new Set(matches)),
        });
    }
}

if (violations.length > 0) {
    console.error(JSON.stringify({
        ok: false,
        message: 'Executable release surfaces must not reference legacy SQL sources.',
        violations,
    }, null, 2));
    process.exit(1);
}

console.log(JSON.stringify({
    ok: true,
    checked: candidateFiles.map((candidatePath) => path.relative(process.cwd(), candidatePath)),
}, null, 2));
