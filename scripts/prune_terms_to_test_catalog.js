const { createClient } = require('@supabase/supabase-js');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const process = require('node:process');
const util = require('node:util');

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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fintechterms-prune-'));

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
            path.resolve(process.cwd(), 'data/terms/test-catalog.ts'),
        ], {
            stdio: 'pipe',
        });

        const compiledModulePath = path.join(tempDir, 'data/terms/test-catalog.js');
        const { testCatalogTerms } = require(compiledModulePath);
        return Array.isArray(testCatalogTerms) ? testCatalogTerms : [];
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

const mapTermsToRecords = (terms) => (
    terms.map((term) => ({
        id: term.id,
        term_en: term.term_en,
        term_ru: term.term_ru,
        term_tr: term.term_tr,
        phonetic_en: term.phonetic_en || null,
        phonetic_ru: term.phonetic_ru || null,
        phonetic_tr: term.phonetic_tr || null,
        category: term.category,
        definition_en: term.definition_en,
        definition_ru: term.definition_ru,
        definition_tr: term.definition_tr,
        example_sentence_en: term.example_sentence_en,
        example_sentence_ru: term.example_sentence_ru,
        example_sentence_tr: term.example_sentence_tr,
    }))
);

async function main() {
    loadLocalEnv();

    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const repoTerms = loadRepoTerms();

    if (repoTerms.length !== 5) {
        throw new Error(`Expected 5 repo test terms, found ${repoTerms.length}.`);
    }

    const keepIds = repoTerms.map((term) => term.id);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    const { error: upsertError } = await supabase
        .from('terms')
        .upsert(mapTermsToRecords(repoTerms), { onConflict: 'id' });

    if (upsertError) {
        throw upsertError;
    }

    const keepFilter = `(${keepIds.map((id) => `"${id}"`).join(',')})`;
    const { error: deleteError } = await supabase
        .from('terms')
        .delete()
        .not('id', 'in', keepFilter);

    if (deleteError) {
        throw deleteError;
    }

    const { count, error: countError } = await supabase
        .from('terms')
        .select('id', { count: 'exact', head: true });

    if (countError) {
        throw countError;
    }

    process.stdout.write(`${JSON.stringify({
        ok: true,
        keptIds: keepIds,
        count,
    }, null, 2)}\n`);
}

main().catch((error) => {
    console.error(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown prune failure.',
        detail: error instanceof Error
            ? {
                name: error.name,
                stack: error.stack,
            }
            : util.inspect(error, { depth: 5 }),
    }, null, 2));
    process.exit(1);
});
