import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ROUTES = [
    '/ru',
    '/ru/topics/cards-payments',
    '/ru/glossary/tokenization',
];

const budgets = {
    lcp: 2500,
    tbt: 200,
    cls: 0.1,
    seo: 95,
    performance: 85,
};

const tempDir = mkdtempSync(join(tmpdir(), 'ftt-lighthouse-'));

const runLighthouse = (route) => {
    const outputPath = join(tempDir, route.replace(/[^\w]/g, '_') || 'root');
    execFileSync(
        'npx',
        [
            '--yes',
            'lighthouse',
            `${BASE_URL}${route}`,
            '--quiet',
            '--chrome-flags=--headless=new --no-sandbox',
            '--only-categories=performance,seo',
            '--output=json',
            `--output-path=${outputPath}`,
        ],
        { stdio: 'inherit' }
    );

    return JSON.parse(readFileSync(outputPath, 'utf8'));
};

try {
    const failures = [];

    for (const route of ROUTES) {
        const report = runLighthouse(route);
        const performanceScore = Math.round((report.categories.performance.score ?? 0) * 100);
        const seoScore = Math.round((report.categories.seo.score ?? 0) * 100);
        const lcp = report.audits['largest-contentful-paint']?.numericValue ?? Number.POSITIVE_INFINITY;
        const tbt = report.audits['total-blocking-time']?.numericValue ?? Number.POSITIVE_INFINITY;
        const cls = report.audits['cumulative-layout-shift']?.numericValue ?? Number.POSITIVE_INFINITY;

        if (performanceScore < budgets.performance) {
            failures.push(`${route}: performance score ${performanceScore} < ${budgets.performance}`);
        }
        if (seoScore < budgets.seo) {
            failures.push(`${route}: seo score ${seoScore} < ${budgets.seo}`);
        }
        if (lcp > budgets.lcp) {
            failures.push(`${route}: LCP ${lcp.toFixed(0)}ms > ${budgets.lcp}ms`);
        }
        if (tbt > budgets.tbt) {
            failures.push(`${route}: TBT ${tbt.toFixed(0)}ms > ${budgets.tbt}ms`);
        }
        if (cls > budgets.cls) {
            failures.push(`${route}: CLS ${cls.toFixed(3)} > ${budgets.cls}`);
        }
    }

    if (failures.length > 0) {
        console.error('\nSEO lighthouse budget failures:\n');
        for (const failure of failures) {
            console.error(`- ${failure}`);
        }
        process.exit(1);
    }

    console.log('SEO lighthouse budgets passed.');
} finally {
    rmSync(tempDir, { recursive: true, force: true });
}
