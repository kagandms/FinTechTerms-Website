const { createClient } = require('@supabase/supabase-js');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const candidateEnvFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
];

const loadLocalEnv = () => {
    for (const candidateFile of candidateEnvFiles) {
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

const getRequiredEnv = (key) => {
    const value = process.env[key]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
};

const loadRepoTerms = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fintechterms-catalog-'));

    try {
        const tscPath = require.resolve('typescript/bin/tsc');
        execFileSync(process.execPath, [
            tscPath,
            '--outDir',
            tempDir,
            '--module',
            'commonjs',
            '--target',
            'ES2020',
            '--moduleResolution',
            'node',
            '--esModuleInterop',
            '--resolveJsonModule',
            '--pretty',
            'false',
            path.resolve(process.cwd(), 'data/mockData.ts'),
        ], {
            stdio: 'pipe',
        });

        const compiledModulePath = path.join(tempDir, 'data/mockData.js');
        const { mockTerms } = require(compiledModulePath);
        return Array.isArray(mockTerms) ? mockTerms : [];
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

const fetchAllMirrorTerms = async (supabase, pageSize = 1000) => {
    const rows = [];

    for (let start = 0; ; start += pageSize) {
        const end = start + pageSize - 1;
        const { data, error } = await supabase
            .from('terms')
            .select('id, slug')
            .order('id', { ascending: true })
            .range(start, end);

        if (error) {
            throw error;
        }

        const page = Array.isArray(data) ? data : [];
        rows.push(...page);

        if (page.length < pageSize) {
            return rows;
        }
    }
};

const compareTerms = (repoTerms, mirrorTerms) => {
    const repoById = new Map(repoTerms.map((term) => [term.id, term.slug]));
    const mirrorById = new Map(
        mirrorTerms
            .filter((term) => typeof term.id === 'string' && typeof term.slug === 'string')
            .map((term) => [term.id, term.slug])
    );

    const missingIds = [];
    const extraIds = [];
    const slugMismatches = [];

    for (const [id, slug] of repoById.entries()) {
        if (!mirrorById.has(id)) {
            missingIds.push(id);
            continue;
        }

        const mirrorSlug = mirrorById.get(id);
        if (mirrorSlug !== slug) {
            slugMismatches.push({
                id,
                repoSlug: slug,
                mirrorSlug,
            });
        }
    }

    for (const id of mirrorById.keys()) {
        if (!repoById.has(id)) {
            extraIds.push(id);
        }
    }

    return {
        repoCount: repoById.size,
        mirrorCount: mirrorById.size,
        missingIds,
        extraIds,
        slugMismatches,
    };
};

async function main() {
    loadLocalEnv();

    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const repoTerms = loadRepoTerms();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
    const mirrorTerms = await fetchAllMirrorTerms(supabase);
    const comparison = compareTerms(repoTerms, mirrorTerms);
    const ok = (
        comparison.repoCount === comparison.mirrorCount
        && comparison.missingIds.length === 0
        && comparison.extraIds.length === 0
        && comparison.slugMismatches.length === 0
    );

    const output = {
        ok,
        ...comparison,
    };

    const writer = ok ? console.log : console.error;
    writer(JSON.stringify(output, null, 2));

    if (!ok) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown verification failure.',
    }, null, 2));
    process.exit(1);
});
