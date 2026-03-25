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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fintechterms-sync-'));

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

const mapTermsToRecords = (terms) => (
    terms.map((term) => ({
        id: term.id,
        slug: term.slug,
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
        short_definition: term.short_definition,
        expanded_definition: term.expanded_definition,
        why_it_matters: term.why_it_matters,
        how_it_works: term.how_it_works,
        risks_and_pitfalls: term.risks_and_pitfalls,
        regional_notes: term.regional_notes,
        seo_title: term.seo_title,
        seo_description: term.seo_description,
        context_tags: term.context_tags,
        regional_markets: term.regional_markets,
        primary_market: term.primary_market,
        regional_market: term.regional_market,
        is_academic: term.is_academic,
        difficulty_level: term.difficulty_level,
        related_term_ids: term.related_term_ids,
        comparison_term_id: term.comparison_term_id,
        prerequisite_term_id: term.prerequisite_term_id,
        topic_ids: term.topic_ids,
        source_refs: term.source_refs,
        author_id: term.author_id,
        reviewer_id: term.reviewer_id,
        reviewed_at: term.reviewed_at,
        updated_at: term.updated_at,
        index_priority: term.index_priority,
    }))
);

async function main() {
    loadLocalEnv();

    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const repoTerms = loadRepoTerms();

    if (repoTerms.length < 1000) {
        throw new Error(`Expected full repo corpus, found only ${repoTerms.length} terms.`);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    const BATCH_SIZE = 100;
    for (let start = 0; start < repoTerms.length; start += BATCH_SIZE) {
        const batch = repoTerms.slice(start, start + BATCH_SIZE);
        const { error } = await supabase
            .from('terms')
            .upsert(mapTermsToRecords(batch), { onConflict: 'id' });

        if (error) {
            throw error;
        }
    }

    process.stdout.write(`${JSON.stringify({
        ok: true,
        syncedTerms: repoTerms.length,
    }, null, 2)}\n`);
}

main().catch((error) => {
    console.error(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown sync failure.',
        detail: error instanceof Error
            ? {
                name: error.name,
                stack: error.stack,
            }
            : util.inspect(error, { depth: 5 }),
    }, null, 2));
    process.exit(1);
});
