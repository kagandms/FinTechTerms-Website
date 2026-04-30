#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);

const LANGUAGES = ['en', 'ru', 'tr'];
const MIN_PILOT_SCORE = 90;
const REPORT_PATH = path.resolve(process.cwd(), 'docs/editorial-authority-audit.md');
const CONTENT_FIELDS = [
    'expanded_definition',
    'why_it_matters',
    'how_it_works',
    'risks_and_pitfalls',
    'regional_notes',
    'seo_title',
    'seo_description',
];
const HIGH_AUTHORITY_SOURCE_TYPES = new Set(['documentation', 'regulation', 'research']);

const print = (message) => {
    process.stdout.write(`${message}\n`);
};

const parseOptions = (argv = process.argv.slice(2)) => {
    const allowedArgs = new Set(['--check', '--write']);
    const unknownArgs = argv.filter((arg) => !allowedArgs.has(arg));

    if (unknownArgs.length > 0) {
        throw new Error(`Unknown editorial authority audit option(s): ${unknownArgs.join(', ')}`);
    }

    return {
        shouldCheck: argv.includes('--check') || argv.length === 0,
        shouldWrite: argv.includes('--write'),
    };
};

const createAuditTsConfig = (tempDir, entryPaths) => ({
    compilerOptions: {
        outDir: tempDir,
        rootDir: process.cwd(),
        module: 'commonjs',
        target: 'ES2020',
        moduleResolution: 'node',
        esModuleInterop: true,
        resolveJsonModule: true,
        skipLibCheck: true,
        baseUrl: process.cwd(),
        paths: {
            '@/*': ['./*'],
        },
        pretty: false,
    },
    files: entryPaths,
});

const compileAuditModules = (tempDir) => {
    const entryPaths = [
        'data/terms/repo-catalog.ts',
        'data/seo/priority-terms.ts',
        'data/seo/editorial-authority.ts',
        'data/seo/sources.ts',
    ].map((relativePath) => path.resolve(process.cwd(), relativePath));
    const tsConfigPath = path.join(tempDir, 'tsconfig.audit.json');
    const tsConfig = createAuditTsConfig(tempDir, entryPaths);

    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
    execFileSync(process.execPath, [
        require.resolve('typescript/bin/tsc'),
        '--project',
        tsConfigPath,
    ], { stdio: 'pipe' });
};

const loadCompiledModule = (tempDir, relativePath) => (
    require(path.join(tempDir, relativePath))
);

const loadAuditData = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fintechterms-editorial-'));

    try {
        compileAuditModules(tempDir);

        return {
            terms: loadCompiledModule(tempDir, 'data/terms/repo-catalog.js').fullRepoTerms,
            priorityRecords: loadCompiledModule(tempDir, 'data/seo/priority-terms.js').priorityTermRecords,
            sources: loadCompiledModule(tempDir, 'data/seo/sources.js').seoSources,
            pilotSlugs: loadCompiledModule(tempDir, 'data/seo/editorial-authority.js').editorialAuthorityPilotSlugs,
            overrides: loadCompiledModule(tempDir, 'data/seo/editorial-authority.js').editorialAuthorityOverrides,
        };
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

const indexBy = (items, getKey) => new Map(items.map((item) => [getKey(item), item]));

const isLocalizedTextComplete = (value, minLength = 1) => (
    LANGUAGES.every((language) => (
        typeof value?.[language] === 'string'
        && value[language].trim().length >= minLength
    ))
);

const getFieldMinLength = (field) => {
    if (field === 'seo_title') return 28;
    if (field === 'seo_description') return 70;
    return 110;
};

const getIncompleteOverrideFields = (override) => {
    const missingFields = [];

    if (!isLocalizedTextComplete(override?.searchIntent, 50)) {
        missingFields.push('searchIntent');
    }
    if (!isLocalizedTextComplete(override?.authorityRationale, 50)) {
        missingFields.push('authorityRationale');
    }
    for (const field of CONTENT_FIELDS) {
        if (!isLocalizedTextComplete(override?.content?.[field], getFieldMinLength(field))) {
            missingFields.push(field);
        }
    }

    return missingFields;
};

const getSourcesForIds = (sourceIds, sourceById) => (
    sourceIds.map((sourceId) => sourceById.get(sourceId)).filter(Boolean)
);

const countHighAuthoritySources = (sources) => (
    sources.filter((source) => HIGH_AUTHORITY_SOURCE_TYPES.has(source.type)).length
);

const scoreSearchIntent = (override, priorityRecord) => {
    if (isLocalizedTextComplete(override?.searchIntent, 50)) return 20;
    if (priorityRecord) return 14;
    return 8;
};

const scoreSourceQuality = (sourceIds, sources) => {
    if (sourceIds.length >= 3 && countHighAuthoritySources(sources) > 0) return 20;
    if (sourceIds.length >= 3) return 16;
    if (sourceIds.length >= 2) return 10;
    return 0;
};

const scoreContentDepth = (override) => {
    const completeFields = CONTENT_FIELDS.filter((field) => (
        isLocalizedTextComplete(override?.content?.[field], getFieldMinLength(field))
    ));

    if (completeFields.length === CONTENT_FIELDS.length) return 20;
    if (completeFields.length >= 5) return 14;
    if (completeFields.length >= 3) return 8;
    return 0;
};

const scoreRegionalRisk = (override, sources) => {
    const hasRisk = isLocalizedTextComplete(override?.content?.risks_and_pitfalls, 110);
    const hasRegionalNotes = isLocalizedTextComplete(override?.content?.regional_notes, 110);
    const hasHighAuthoritySource = countHighAuthoritySources(sources) > 0;

    if (hasRisk && hasRegionalNotes && hasHighAuthoritySource) return 15;
    if (hasRisk && hasRegionalNotes) return 12;
    return 6;
};

const scoreInternalLinks = (priorityRecord) => {
    if (!priorityRecord) return 6;
    if (
        priorityRecord.relatedSlugs.length >= 3
        && priorityRecord.comparisonSlug
        && priorityRecord.prerequisiteSlug
    ) return 15;
    if (priorityRecord.relatedSlugs.length >= 3) return 10;
    return 6;
};

const scoreLanguageQuality = (override) => (
    getIncompleteOverrideFields(override).length === 0 ? 10 : 4
);

const scorePilotTerm = (context) => {
    const sources = getSourcesForIds(context.sourceIds, context.sourceById);
    const components = {
        searchIntent: scoreSearchIntent(context.override, context.priorityRecord),
        sourceQuality: scoreSourceQuality(context.sourceIds, sources),
        contentDepth: scoreContentDepth(context.override),
        regionalRisk: scoreRegionalRisk(context.override, sources),
        internalLinks: scoreInternalLinks(context.priorityRecord),
        languageQuality: scoreLanguageQuality(context.override),
    };

    return {
        ...components,
        total: Object.values(components).reduce((sum, score) => sum + score, 0),
        highAuthoritySourceCount: countHighAuthoritySources(sources),
    };
};

const getUnknownSourceIds = (sourceIds, sourceById) => (
    sourceIds.filter((sourceId) => !sourceById.has(sourceId))
);

const buildPilotScore = (slug, maps, overrides) => {
    const override = overrides[slug] ?? null;
    const sourceIds = override?.sourceIds ?? [];

    return {
        slug,
        hasTerm: maps.termBySlug.has(slug),
        hasOverride: Boolean(override),
        unknownSourceIds: getUnknownSourceIds(sourceIds, maps.sourceById),
        missingFields: getIncompleteOverrideFields(override),
        sourceIds,
        score: scorePilotTerm({
            override,
            sourceIds,
            sourceById: maps.sourceById,
            priorityRecord: maps.priorityRecordBySlug.get(slug) ?? null,
        }),
    };
};

const buildPriorityIssues = (priorityRecords, maps) => (
    priorityRecords.flatMap((record) => {
        const issues = [];

        if (!maps.termBySlug.has(record.slug)) issues.push('unknown term');
        if (record.requiredSourceIds.length < 3) issues.push('source quorum');
        if (getUnknownSourceIds(record.requiredSourceIds, maps.sourceById).length > 0) issues.push('unknown source');
        if (record.relatedSlugs.length < 3) issues.push('related terms');
        if (!record.comparisonSlug) issues.push('comparison term');
        if (!record.prerequisiteSlug) issues.push('prerequisite term');

        return issues.length > 0 ? [`${record.slug}: ${issues.join(', ')}`] : [];
    })
);

const buildAudit = (data) => {
    const maps = {
        termBySlug: indexBy(data.terms, (term) => term.slug),
        sourceById: indexBy(data.sources, (source) => source.id),
        priorityRecordBySlug: indexBy(data.priorityRecords, (record) => record.slug),
    };
    const pilotScores = data.pilotSlugs.map((slug) => buildPilotScore(slug, maps, data.overrides));

    return {
        generatedAt: new Date().toISOString(),
        priorityTermCount: data.priorityRecords.length,
        pilotScores,
        priorityIssues: buildPriorityIssues(data.priorityRecords, maps),
    };
};

const buildPilotIssues = (pilotScores) => (
    pilotScores.flatMap((pilotScore) => {
        const issues = [];

        if (!pilotScore.hasTerm) issues.push('unknown term');
        if (!pilotScore.hasOverride) issues.push('missing override');
        if (pilotScore.sourceIds.length < 3) issues.push('source quorum');
        if (pilotScore.score.highAuthoritySourceCount < 1) issues.push('primary source');
        if (pilotScore.unknownSourceIds.length > 0) issues.push(`unknown source: ${pilotScore.unknownSourceIds.join(', ')}`);
        if (pilotScore.missingFields.length > 0) issues.push(`incomplete fields: ${pilotScore.missingFields.join(', ')}`);
        if (pilotScore.score.total < MIN_PILOT_SCORE) issues.push(`score below ${MIN_PILOT_SCORE}: ${pilotScore.score.total}`);

        return issues.length > 0 ? [`${pilotScore.slug}: ${issues.join('; ')}`] : [];
    })
);

const getAveragePilotScore = (pilotScores) => {
    const totalScore = pilotScores.reduce((sum, pilotScore) => sum + pilotScore.score.total, 0);
    return Math.round(totalScore / Math.max(pilotScores.length, 1));
};

const renderPilotRows = (pilotScores) => (
    pilotScores.map((pilotScore, index) => [
        index + 1,
        pilotScore.slug,
        pilotScore.score.total,
        pilotScore.sourceIds.length,
        pilotScore.score.highAuthoritySourceCount,
        pilotScore.score.internalLinks,
    ].join(' | '))
);

const renderAuditReport = (audit) => {
    const pilotIssues = buildPilotIssues(audit.pilotScores);
    const allIssues = [...pilotIssues, ...audit.priorityIssues];
    const issueLines = allIssues.length > 0
        ? allIssues.map((issue) => `- ${issue}`)
        : ['- No blocking editorial authority issues found.'];

    return [
        '# Editorial Authority Audit',
        '',
        `Generated: ${audit.generatedAt}`,
        '',
        '## Summary',
        '',
        `- Pilot authority terms: ${audit.pilotScores.length}`,
        `- Average pilot score: ${getAveragePilotScore(audit.pilotScores)}/100`,
        `- Priority registry terms: ${audit.priorityTermCount}`,
        `- Blocking issues: ${allIssues.length}`,
        '',
        '## Pilot Score Table',
        '',
        'No | Slug | Score | Sources | High-authority sources | Internal-link score',
        '-- | ---- | ----- | ------- | ---------------------- | -------------------',
        ...renderPilotRows(audit.pilotScores),
        '',
        '## Issues',
        '',
        ...issueLines,
        '',
    ].join('\n');
};

const writeReport = (report) => {
    fs.writeFileSync(REPORT_PATH, report);
    print(`Wrote ${path.relative(process.cwd(), REPORT_PATH)}`);
};

const assertAuditPassed = (audit) => {
    const issues = [...buildPilotIssues(audit.pilotScores), ...audit.priorityIssues];

    if (issues.length === 0) {
        return;
    }

    throw new Error(`Editorial authority audit failed:\n${issues.join('\n')}`);
};

const main = () => {
    const options = parseOptions();
    const audit = buildAudit(loadAuditData());
    const report = renderAuditReport(audit);

    if (options.shouldWrite) {
        writeReport(report);
    }
    if (!options.shouldWrite) {
        print(report);
    }
    if (options.shouldCheck || options.shouldWrite) {
        assertAuditPassed(audit);
    }
};

try {
    main();
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
}
