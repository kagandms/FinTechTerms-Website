import { chromium } from '@playwright/test';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

const requiredEnv = (name) => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

const optionalEnv = (name) => process.env[name]?.trim() || null;

const readPositiveIntegerEnv = (name, fallback) => {
    const rawValue = optionalEnv(name);

    if (!rawValue) {
        return fallback;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error(`${name} must be a positive integer.`);
    }

    return parsedValue;
};

const readNonNegativeNumberEnv = (name, fallback) => {
    const rawValue = optionalEnv(name);

    if (!rawValue) {
        return fallback;
    }

    const parsedValue = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        throw new Error(`${name} must be a non-negative number.`);
    }

    return parsedValue;
};

const stagingBaseUrl = requiredEnv('STAGING_BASE_URL').replace(/\/$/, '');
const authCredentials = {
    email: requiredEnv('E2E_AUTH_EMAIL'),
    password: requiredEnv('E2E_AUTH_PASSWORD'),
};
const vercelAutomationBypassSecret = optionalEnv('VERCEL_AUTOMATION_BYPASS_SECRET');

const loadConfig = {
    concurrency: readPositiveIntegerEnv('LOAD_TEST_CONCURRENCY', 4),
    iterations: readPositiveIntegerEnv('LOAD_TEST_ITERATIONS', 12),
    p95BudgetMs: readPositiveIntegerEnv('LOAD_TEST_P95_MS', 1_500),
    p99BudgetMs: readPositiveIntegerEnv('LOAD_TEST_P99_MS', 2_500),
    maxErrorRate: readNonNegativeNumberEnv('LOAD_TEST_MAX_ERROR_RATE', 0),
};

const NETWORK_IDLE_TIMEOUT_MS = 10_000;

const scenarios = [
    {
        name: 'progress-summary',
        method: 'GET',
        path: '/api/progress',
    },
    {
        name: 'srs-progress',
        method: 'POST',
        path: '/api/progress/srs',
        body: JSON.stringify({
            termIds: ['term_001'],
        }),
    },
];

const writeJson = (payload) => {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
};

const createBypassedContext = async (browser) => browser.newContext({
    extraHTTPHeaders: vercelAutomationBypassSecret
        ? {
            'x-vercel-protection-bypass': vercelAutomationBypassSecret,
            'x-vercel-set-bypass-cookie': 'true',
        }
        : undefined,
});

const grantResearchConsent = async (page) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('fintechterms_research_consent', JSON.stringify({
            given: true,
            timestamp: '2026-03-11T00:00:00.000Z',
            version: '1.0',
        }));
    });
};

const waitForPageSettle = async (page) => {
    await page.waitForLoadState('load', { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown load-state timeout.';
        process.stderr.write(`Staging load check skipped load wait: ${message}\n`);
    });

    await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown network-idle timeout.';
        process.stderr.write(`Staging load check skipped network-idle wait: ${message}\n`);
    });

    await page.waitForTimeout(500);
};

const readPageDebugState = async (page) => ({
    url: page.url(),
    title: await page.title(),
    hasAuthModal: await page.getByTestId('auth-modal').isVisible().catch(() => false),
    hasLoginButton: await page.getByTestId('open-auth-login').isVisible().catch(() => false),
    hasAvatar: await page.getByTestId('user-avatar').isVisible().catch(() => false),
    bodySnippet: (await page.locator('body').innerText().catch(() => ''))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300),
});

const loginViaProfile = async (page) => {
    await page.goto(`${stagingBaseUrl}/profile?auth=login`, { waitUntil: 'domcontentloaded' });
    await waitForPageSettle(page);

    if (await page.getByTestId('user-avatar').isVisible().catch(() => false)) {
        return;
    }

    const authModal = page.getByTestId('auth-modal');
    if (!await authModal.isVisible().catch(() => false)) {
        const loginButton = page.getByTestId('open-auth-login');
        if (await loginButton.isVisible().catch(() => false)) {
            await loginButton.click({ force: true });
        }
    }

    try {
        await authModal.waitFor({ state: 'visible', timeout: 20_000 });
    } catch {
        const debugState = await readPageDebugState(page);
        throw new Error(
            `Authentication modal did not become visible. Debug: ${JSON.stringify(debugState)}`
        );
    }

    await page.getByTestId('auth-email').fill(authCredentials.email);
    await page.getByTestId('auth-password').fill(authCredentials.password);
    await page.getByTestId('auth-submit').click();
    await page.getByTestId('user-avatar').waitFor({ state: 'visible', timeout: 20_000 });
};

const resolveSupabaseAccessTokenFromStorage = async (page) => (
    await page.evaluate(() => {
        for (const key of Object.keys(window.localStorage)) {
            if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) {
                continue;
            }

            const rawValue = window.localStorage.getItem(key);
            if (!rawValue) {
                continue;
            }

            try {
                const parsedValue = JSON.parse(rawValue);

                if (parsedValue?.access_token) {
                    return parsedValue.access_token;
                }

                if (Array.isArray(parsedValue)) {
                    const tokenEntry = parsedValue.find((entry) => entry?.access_token);
                    if (tokenEntry?.access_token) {
                        return tokenEntry.access_token;
                    }
                }
            } catch {
                continue;
            }
        }

        return null;
    })
);

const resolveAccessToken = async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await createBypassedContext(browser);
    const page = await context.newPage();

    try {
        await grantResearchConsent(page);
        await loginViaProfile(page);

        const accessToken = await resolveSupabaseAccessTokenFromStorage(page);
        if (!accessToken) {
            throw new Error('Authenticated staging session did not expose a Supabase access token.');
        }

        return accessToken;
    } finally {
        await context.close();
        await browser.close();
    }
};

const createScenarioHeaders = (scenario, accessToken) => {
    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
    };

    if (scenario.body) {
        headers['Content-Type'] = 'application/json';
    }

    if (vercelAutomationBypassSecret) {
        headers['x-vercel-protection-bypass'] = vercelAutomationBypassSecret;
    }

    return headers;
};

const runScenarioRequest = async (scenario, accessToken) => {
    const startedAtMs = performance.now();
    const response = await fetch(`${stagingBaseUrl}${scenario.path}`, {
        method: scenario.method,
        headers: createScenarioHeaders(scenario, accessToken),
        body: scenario.body,
    });
    const responseText = await response.text();
    const durationMs = performance.now() - startedAtMs;

    return {
        scenario: scenario.name,
        method: scenario.method,
        path: scenario.path,
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        durationMs: Number(durationMs.toFixed(2)),
        bodySnippet: responseText.replace(/\s+/g, ' ').trim().slice(0, 240),
    };
};

const assertWarmupSucceeded = (samples) => {
    const failedSamples = samples.filter((sample) => !sample.ok);

    if (failedSamples.length > 0) {
        throw new Error(`Staging load warmup failed: ${JSON.stringify(failedSamples)}`);
    }
};

const runWithConcurrency = async (items, concurrency, worker) => {
    const results = new Array(items.length);
    let nextIndex = 0;

    const runNext = async () => {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
            return;
        }

        results[currentIndex] = await worker(items[currentIndex], currentIndex);
        await runNext();
    };

    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => runNext()));

    return results;
};

const calculatePercentile = (values, percentile) => {
    if (values.length === 0) {
        return 0;
    }

    const sortedValues = [...values].sort((first, second) => first - second);
    const rank = Math.ceil((percentile / 100) * sortedValues.length);
    return sortedValues[Math.max(rank - 1, 0)];
};

const summarizeSamples = (samples) => scenarios.map((scenario) => {
    const scenarioSamples = samples.filter((sample) => sample.scenario === scenario.name);
    const durations = scenarioSamples.map((sample) => sample.durationMs);
    const errorCount = scenarioSamples.filter((sample) => !sample.ok).length;
    const averageDurationMs = durations.reduce((total, duration) => total + duration, 0) / durations.length;

    return {
        scenario: scenario.name,
        method: scenario.method,
        path: scenario.path,
        requests: scenarioSamples.length,
        errors: errorCount,
        errorRate: Number((errorCount / scenarioSamples.length).toFixed(4)),
        averageMs: Number(averageDurationMs.toFixed(2)),
        p95Ms: Number(calculatePercentile(durations, 95).toFixed(2)),
        p99Ms: Number(calculatePercentile(durations, 99).toFixed(2)),
        maxMs: Number(Math.max(...durations).toFixed(2)),
    };
});

const findBudgetFailures = (summaries) => summaries.filter((summary) => (
    summary.errorRate > loadConfig.maxErrorRate
    || summary.p95Ms > loadConfig.p95BudgetMs
    || summary.p99Ms > loadConfig.p99BudgetMs
));

const buildWorkload = () => Array.from({ length: loadConfig.iterations }).flatMap(() => scenarios);

const runStagingLoadCheck = async () => {
    const accessToken = await resolveAccessToken();
    const warmupSamples = await Promise.all(
        scenarios.map((scenario) => runScenarioRequest(scenario, accessToken))
    );
    assertWarmupSucceeded(warmupSamples);

    const samples = await runWithConcurrency(
        buildWorkload(),
        loadConfig.concurrency,
        async (scenario) => await runScenarioRequest(scenario, accessToken)
    );
    const summaries = summarizeSamples(samples);
    const budgetFailures = findBudgetFailures(summaries);

    writeJson({
        ok: budgetFailures.length === 0,
        config: loadConfig,
        summaries,
        budgetFailures,
        failedSamples: samples
            .filter((sample) => !sample.ok)
            .slice(0, 10),
    });

    if (budgetFailures.length > 0) {
        process.exitCode = 1;
    }
};

try {
    await runStagingLoadCheck();
} catch (error) {
    writeJson({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown staging load check failure.',
    });
    process.exitCode = 1;
}
