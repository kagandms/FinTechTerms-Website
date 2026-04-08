import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const loadLocalEnv = () => {
    const candidateFiles = [
        path.resolve(process.cwd(), '.env.local'),
        path.resolve(process.cwd(), '.env'),
    ];

    for (const candidateFile of candidateFiles) {
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

loadLocalEnv();

const requiredEnv = (name) => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

const optionalEnv = (name) => process.env[name]?.trim() || null;

const stagingBaseUrl = requiredEnv('STAGING_BASE_URL').replace(/\/$/, '');
const smokeAuthEmail = optionalEnv('SMOKE_AUTH_EMAIL') || optionalEnv('E2E_AUTH_EMAIL');
const smokeAuthPassword = optionalEnv('SMOKE_AUTH_PASSWORD') || optionalEnv('E2E_AUTH_PASSWORD');
const sentrySmokeEmail = optionalEnv('SENTRY_SMOKE_EMAIL') || smokeAuthEmail;
const sentrySmokePassword = optionalEnv('SENTRY_SMOKE_PASSWORD') || smokeAuthPassword;
const vercelAutomationBypassSecret = optionalEnv('VERCEL_AUTOMATION_BYPASS_SECRET');
const NETWORK_IDLE_TIMEOUT_MS = 10_000;

const smokeChecks = [];

const recordCheck = (name, passed, detail) => {
    smokeChecks.push({ name, passed, detail });
};

const assertCondition = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
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
    await page.waitForLoadState('load', { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => undefined);

    try {
        await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS });
    } catch {
        // Staging can keep background requests open after the UI is already interactive.
    }

    await page.waitForTimeout(500);
};

const readSupabaseAccessToken = async (page) => {
    const accessToken = await page.evaluate(() => {
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

                if (parsedValue && typeof parsedValue === 'object' && typeof parsedValue.access_token === 'string') {
                    return parsedValue.access_token;
                }

                if (Array.isArray(parsedValue)) {
                    const tokenEntry = parsedValue.find((entry) => (
                        entry
                        && typeof entry === 'object'
                        && typeof entry.access_token === 'string'
                    ));

                    if (tokenEntry) {
                        return tokenEntry.access_token;
                    }
                }
            } catch {
                // Ignore malformed localStorage entries and continue scanning.
            }
        }

        return null;
    });

    if (!accessToken) {
        throw new Error('Unable to resolve a Supabase access token from browser storage.');
    }

    return accessToken;
};

const runGuestSmoke = async (page) => {
    await page.goto(`${stagingBaseUrl}/`, { waitUntil: 'domcontentloaded' });
    await waitForPageSettle(page);
    await page.locator('[data-testid="theme-toggle"]:visible').first().waitFor({ state: 'visible' });
    recordCheck('guest-home', true, 'Homepage rendered with theme toggle.');

    await page.goto(`${stagingBaseUrl}/search`, { waitUntil: 'domcontentloaded' });
    await waitForPageSettle(page);
    await page.getByTestId('search-input').waitFor({ state: 'visible' });
    await page.getByTestId('search-input').fill('SQL');
    await page.getByText(/^SQL$/i).first().waitFor({ state: 'visible' });
    recordCheck('guest-search', true, 'Search input and results rendered.');

    await page.goto(`${stagingBaseUrl}/quiz`, { waitUntil: 'domcontentloaded' });
    await waitForPageSettle(page);
    const dueCountText = await page.getByTestId('due-card-count').first().textContent();
    assertCondition(dueCountText !== null, 'Quiz due count did not render.');
    recordCheck('guest-quiz', true, `Quiz rendered with due count ${dueCountText.trim()}.`);

    await page.goto(`${stagingBaseUrl}/profile`, { waitUntil: 'domcontentloaded' });
    await waitForPageSettle(page);
    await page.getByTestId('open-auth-login').waitFor({ state: 'visible' });
    await page.getByTestId('open-auth-register').waitFor({ state: 'visible' });
    recordCheck('guest-profile', true, 'Guest profile CTA rendered.');
};

const loginViaProfile = async (page, email, password) => {
    await page.goto(`${stagingBaseUrl}/profile?auth=login`, { waitUntil: 'domcontentloaded' });
    await waitForPageSettle(page);

    if (await page.getByTestId('user-avatar').isVisible().catch(() => false)) {
        return;
    }

    const authModal = page.getByTestId('auth-modal');

    if (!await authModal.isVisible().catch(() => false)) {
        await page.getByTestId('open-auth-login').click({ force: true });
    }

    await authModal.waitFor({ state: 'visible', timeout: 20_000 });
    await page.getByTestId('auth-email').fill(email);
    await page.getByTestId('auth-password').fill(password);
    await page.getByTestId('auth-submit').click();
    await page.getByTestId('user-avatar').waitFor({ state: 'visible', timeout: 20_000 });
};

const runAuthenticatedSmoke = async (page) => {
    if (!smokeAuthEmail || !smokeAuthPassword) {
        recordCheck('authenticated-smoke', true, 'Skipped because SMOKE_AUTH credentials were not provided.');
        return;
    }

    await loginViaProfile(page, smokeAuthEmail, smokeAuthPassword);
    recordCheck('authenticated-login', true, `Authenticated smoke login succeeded for ${smokeAuthEmail}.`);
};

const fetchWithBearer = async (page, path, token, init = {}) => (
    await page.evaluate(async ({ routePath, bearerToken, requestInit }) => {
        const response = await fetch(routePath, {
            ...requestInit,
            headers: {
                ...(requestInit.headers || {}),
                Authorization: `Bearer ${bearerToken}`,
            },
        });

        return {
            status: response.status,
            body: await response.json(),
        };
    }, {
        routePath: path,
        bearerToken: token,
        requestInit: init,
    })
);

const runSentrySmoke = async (page) => {
    if (!sentrySmokeEmail || !sentrySmokePassword) {
        throw new Error('Admin Sentry smoke requires SENTRY_SMOKE_EMAIL and SENTRY_SMOKE_PASSWORD.');
    }

    await loginViaProfile(page, sentrySmokeEmail, sentrySmokePassword);
    const accessToken = await readSupabaseAccessToken(page);

    const capabilityResponse = await fetchWithBearer(page, '/api/auth/capabilities', accessToken, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    assertCondition(capabilityResponse.status === 200, `Capabilities endpoint returned ${capabilityResponse.status}.`);
    assertCondition(
        capabilityResponse.body?.isAdmin === true,
        'Sentry smoke user is authenticated but not admin. Verify ADMIN_USER_IDS in the Vercel preview environment includes the SENTRY_SMOKE_EMAIL user id.'
    );

    const response = await fetchWithBearer(page, '/api/admin/sentry-smoke', accessToken, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (response.status === 503 && response.body?.code === 'SENTRY_SMOKE_DISABLED') {
        throw new Error(
            'Sentry smoke endpoint is disabled in the preview runtime. ' +
            'Verify Vercel preview environment variables include NEXT_PUBLIC_SENTRY_DSN.'
        );
    }

    assertCondition(response.status === 200, `Sentry smoke endpoint returned ${response.status}.`);
    assertCondition(Boolean(response.body?.ok), 'Sentry smoke endpoint did not return ok=true.');
    assertCondition(typeof response.body?.eventId === 'string' && response.body.eventId.length > 0, 'Sentry smoke endpoint did not return an eventId.');

    recordCheck('sentry-smoke', true, `Sentry smoke event submitted with eventId ${response.body.eventId}.`);
};

const printSummaryAndExit = () => {
    const failedChecks = smokeChecks.filter((check) => !check.passed);
    console.log(JSON.stringify({
        ok: failedChecks.length === 0,
        checks: smokeChecks,
    }, null, 2));

    if (failedChecks.length > 0) {
        process.exitCode = 1;
    }
};

const browser = await chromium.launch({ headless: true });

try {
    {
        const context = await createBypassedContext(browser);
        const page = await context.newPage();
        await grantResearchConsent(page);
        await runGuestSmoke(page);
        await context.close();
    }

    if (smokeAuthEmail && smokeAuthPassword) {
        const context = await createBypassedContext(browser);
        const page = await context.newPage();
        await grantResearchConsent(page);
        await runAuthenticatedSmoke(page);
        await context.close();
    } else {
        recordCheck('authenticated-smoke', true, 'Skipped because SMOKE_AUTH credentials were not provided.');
    }

    {
        const context = await createBypassedContext(browser);
        const page = await context.newPage();
        await grantResearchConsent(page);
        await runSentrySmoke(page);
        await context.close();
    }
} catch (error) {
    recordCheck('staging-smoke', false, error instanceof Error ? error.message : 'Unknown staging smoke failure.');
} finally {
    await browser.close();
    printSummaryAndExit();
}
