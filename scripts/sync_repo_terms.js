const { createClient } = require('@supabase/supabase-js');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const process = require('node:process');
const util = require('node:util');

const MIN_RELEASE_TERM_COUNT = 900;
const BATCH_SIZE = 25;
const DELETE_BATCH_SIZE = 50;
const MAX_SYNC_RETRIES = 5;
const DESTRUCTIVE_ACK_ENV = 'ALLOW_REMOTE_DESTRUCTIVE_SCRIPTS';
const LOCAL_SUPABASE_HOSTNAMES = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'host.docker.internal',
]);
const REFERENCE_TABLES = [
    'user_favorites',
    'quiz_attempts',
    'user_term_srs',
    'academic_deck_terms',
];
const RETRYABLE_STATUS_PATTERNS = [
    '502',
    '503',
    '504',
    'bad gateway',
    'cloudflare',
    'gateway',
    'temporarily unavailable',
];
const candidateEnvFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
];

const loadLocalEnv = () => {
    for (const candidateFile of candidateEnvFiles) {
        if (!fs.existsSync(candidateFile)) continue;

        const content = fs.readFileSync(candidateFile, 'utf8');
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;

            const separatorIndex = line.indexOf('=');
            if (separatorIndex === -1) continue;

            const key = line.slice(0, separatorIndex).trim();
            if (!key || process.env[key]) continue;

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

const readRequiredServiceRoleKey = (env = process.env) => {
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
        throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
    }

    return serviceRoleKey;
};

const parseSyncOptions = (argv = process.argv.slice(2)) => {
    const allowedArgs = new Set(['--dry-run', '--prune-extra']);
    const unknownArgs = argv.filter((arg) => !allowedArgs.has(arg));

    if (unknownArgs.length > 0) {
        throw new Error(`Unknown sync_repo_terms option(s): ${unknownArgs.join(', ')}`);
    }

    return {
        isDryRun: argv.includes('--dry-run'),
        shouldPruneExtra: argv.includes('--prune-extra'),
    };
};

const assertReleaseCorpusSize = (repoTerms) => {
    if (repoTerms.length < MIN_RELEASE_TERM_COUNT) {
        throw new Error(
            `Expected at least ${MIN_RELEASE_TERM_COUNT} release terms, found only ${repoTerms.length}.`
        );
    }
};

const isLocalSupabaseUrl = (supabaseUrl) => {
    const { hostname } = new URL(supabaseUrl);
    const normalizedHostname = hostname.trim().toLowerCase();
    return (
        LOCAL_SUPABASE_HOSTNAMES.has(normalizedHostname)
        || normalizedHostname.endsWith('.local')
    );
};

const assertSafePruneTarget = (supabaseUrl, options, env = process.env) => {
    if (!options.shouldPruneExtra || options.isDryRun || isLocalSupabaseUrl(supabaseUrl)) {
        return;
    }

    if (env[DESTRUCTIVE_ACK_ENV]?.trim() === '1') {
        return;
    }

    throw new Error(
        `sync_repo_terms refused to prune remote Supabase target ${supabaseUrl}. `
        + `Set ${DESTRUCTIVE_ACK_ENV}=1 to acknowledge destructive staging changes.`
    );
};

const loadRepoTerms = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fintechterms-sync-'));
    const entryPath = path.resolve(process.cwd(), 'data/terms/repo-catalog.ts');

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
            entryPath,
        ], { stdio: 'pipe' });

        const compiledModulePath = path.join(tempDir, 'data/terms/repo-catalog.js');
        const { fullRepoTerms } = require(compiledModulePath);
        return Array.isArray(fullRepoTerms) ? fullRepoTerms : [];
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

const mapTermsToRecords = (terms) => terms.map((term) => ({
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
}));

const sleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

const isRetryableSyncError = (error) => {
    const message = error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

    return RETRYABLE_STATUS_PATTERNS.some((pattern) => message.includes(pattern));
};

const upsertBatchWithRetry = async (supabase, batch, startIndex) => {
    for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt += 1) {
        try {
            const { error } = await supabase
                .from('terms')
                .upsert(mapTermsToRecords(batch), { onConflict: 'id' });

            if (!error) return { ok: true, attempt };
            throw error;
        } catch (error) {
            if (!isRetryableSyncError(error) || attempt >= MAX_SYNC_RETRIES) {
                throw new Error(
                    `Term sync batch starting at index ${startIndex} failed on attempt ${attempt}: ${
                        error instanceof Error ? error.message : util.inspect(error, { depth: 5 })
                    }`
                );
            }

            const backoffMs = attempt * 1500;
            process.stderr.write(`${JSON.stringify({
                ok: false,
                retrying: true,
                batchStart: startIndex,
                attempt,
                backoffMs,
                message: error instanceof Error ? error.message : String(error),
            })}\n`);
            await sleep(backoffMs);
        }
    }

    throw new Error(`Term sync batch starting at index ${startIndex} exhausted retries.`);
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

        if (error) throw error;

        const page = Array.isArray(data) ? data : [];
        rows.push(...page);
        if (page.length < pageSize) return rows;
    }
};

const compareTerms = (repoTerms, mirrorTerms) => {
    const repoById = new Map(repoTerms.map((term) => [term.id, term.slug]));
    const mirrorById = new Map(
        mirrorTerms
            .filter((term) => typeof term.id === 'string' && typeof term.slug === 'string')
            .map((term) => [term.id, term.slug])
    );
    const missingIds = [...repoById.keys()].filter((id) => !mirrorById.has(id));
    const extraIds = [...mirrorById.keys()].filter((id) => !repoById.has(id));
    const slugMismatches = [...repoById.entries()]
        .filter(([id, slug]) => mirrorById.has(id) && mirrorById.get(id) !== slug)
        .map(([id, slug]) => ({ id, repoSlug: slug, mirrorSlug: mirrorById.get(id) }));

    return {
        repoCount: repoById.size,
        mirrorCount: mirrorById.size,
        missingIds,
        extraIds,
        slugMismatches,
    };
};

const fetchReferenceCounts = async (supabase, extraIds) => {
    const counts = Object.fromEntries(REFERENCE_TABLES.map((table) => [table, 0]));
    if (extraIds.length === 0) return counts;

    for (const table of REFERENCE_TABLES) {
        const { count, error } = await supabase
            .from(table)
            .select('term_id', { count: 'exact', head: true })
            .in('term_id', extraIds);

        if (error) throw new Error(`Unable to count ${table} rows for pruned terms: ${error.message}`);
        counts[table] = count ?? 0;
    }

    return counts;
};

const buildImpactReport = (comparison, referenceCounts) => ({
    repoCount: comparison.repoCount,
    mirrorCount: comparison.mirrorCount,
    missingIds: comparison.missingIds,
    missingIdsCount: comparison.missingIds.length,
    extraIds: comparison.extraIds,
    extraIdsCount: comparison.extraIds.length,
    slugMismatches: comparison.slugMismatches,
    slugMismatchesCount: comparison.slugMismatches.length,
    affectedReferenceRows: referenceCounts,
});

const upsertRepoTerms = async (supabase, repoTerms) => {
    for (let start = 0; start < repoTerms.length; start += BATCH_SIZE) {
        const batch = repoTerms.slice(start, start + BATCH_SIZE);
        const result = await upsertBatchWithRetry(supabase, batch, start);

        process.stdout.write(`${JSON.stringify({
            ok: true,
            phase: 'upsert',
            batchStart: start,
            batchSize: batch.length,
            attempt: result.attempt,
        })}\n`);
        await sleep(150);
    }
};

const pruneExtraTerms = async (supabase, extraIds) => {
    for (let start = 0; start < extraIds.length; start += DELETE_BATCH_SIZE) {
        const batch = extraIds.slice(start, start + DELETE_BATCH_SIZE);
        const { error } = await supabase
            .from('terms')
            .delete()
            .in('id', batch);

        if (error) throw error;

        process.stdout.write(`${JSON.stringify({
            ok: true,
            phase: 'prune-extra',
            batchStart: start,
            batchSize: batch.length,
        })}\n`);
    }
};

async function main() {
    loadLocalEnv();

    const options = parseSyncOptions();
    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = readRequiredServiceRoleKey();
    const repoTerms = loadRepoTerms();

    assertReleaseCorpusSize(repoTerms);
    assertSafePruneTarget(supabaseUrl, options);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
    const initialComparison = compareTerms(repoTerms, await fetchAllMirrorTerms(supabase));
    const impactReport = buildImpactReport(
        initialComparison,
        await fetchReferenceCounts(supabase, initialComparison.extraIds)
    );

    process.stdout.write(`${JSON.stringify({
        ok: true,
        phase: 'preflight',
        isDryRun: options.isDryRun,
        shouldPruneExtra: options.shouldPruneExtra,
        impactReport,
    }, null, 2)}\n`);

    if (options.isDryRun) return;

    await upsertRepoTerms(supabase, repoTerms);
    if (options.shouldPruneExtra && initialComparison.extraIds.length > 0) {
        await pruneExtraTerms(supabase, initialComparison.extraIds);
    }

    const finalComparison = compareTerms(repoTerms, await fetchAllMirrorTerms(supabase));
    process.stdout.write(`${JSON.stringify({
        ok: finalComparison.missingIds.length === 0
            && finalComparison.extraIds.length === 0
            && finalComparison.slugMismatches.length === 0,
        phase: 'complete',
        syncedTerms: repoTerms.length,
        finalComparison,
    }, null, 2)}\n`);
}

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(`${JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown sync failure.',
            detail: error instanceof Error
                ? {
                    name: error.name,
                    stack: error.stack,
                }
                : util.inspect(error, { depth: 5 }),
        }, null, 2)}\n`);
        process.exit(1);
    });
}

module.exports = {
    MIN_RELEASE_TERM_COUNT,
    assertReleaseCorpusSize,
    assertSafePruneTarget,
    buildImpactReport,
    compareTerms,
    parseSyncOptions,
    readRequiredServiceRoleKey,
};
