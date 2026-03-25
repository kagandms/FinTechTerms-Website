import { chromium } from '@playwright/test';
import process from 'node:process';

const requiredEnv = (name) => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

const optionalEnv = (name) => process.env[name]?.trim() || null;

const stagingBaseUrl = requiredEnv('STAGING_BASE_URL').replace(/\/$/, '');
const authEmail = requiredEnv('E2E_AUTH_EMAIL');
const authPassword = requiredEnv('E2E_AUTH_PASSWORD');
const sentrySmokeEmail = requiredEnv('SENTRY_SMOKE_EMAIL');
const sentrySmokePassword = requiredEnv('SENTRY_SMOKE_PASSWORD');
const vercelAutomationBypassSecret = optionalEnv('VERCEL_AUTOMATION_BYPASS_SECRET');

const checks = [];

const recordCheck = (name, passed, detail) => {
    checks.push({ name, passed, detail });
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

const waitForPageSettle = async (page) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
};

const loginViaProfile = async (page, email, password) => {
    await page.goto(`${stagingBaseUrl}/profile`, { waitUntil: 'domcontentloaded' });
    await waitForPageSettle(page);

    await page.getByTestId('open-auth-login').click();
    await page.getByTestId('auth-modal').waitFor({ state: 'visible' });
    await page.getByTestId('auth-email').fill(email);
    await page.getByTestId('auth-password').fill(password);
    await page.getByTestId('auth-submit').click();
    await page.getByTestId('user-avatar').waitFor({ state: 'visible', timeout: 20_000 });
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
                // Ignore malformed local storage entries during runtime probing.
            }
        }

        return null;
    });

    if (!accessToken) {
        throw new Error('Unable to resolve a Supabase access token from browser storage.');
    }

    return accessToken;
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

        let body = null;
        try {
            body = await response.json();
        } catch {
            body = null;
        }

        return {
            status: response.status,
            body,
        };
    }, {
        routePath: path,
        bearerToken: token,
        requestInit: init,
    })
);

const runGuestCheck = async (browser) => {
    const context = await createBypassedContext(browser);
    const page = await context.newPage();

    try {
        await page.goto(`${stagingBaseUrl}/`, { waitUntil: 'domcontentloaded' });
        await waitForPageSettle(page);
        await page.locator('[data-testid="theme-toggle"]:visible').first().waitFor({ state: 'visible' });
        recordCheck('guest-home', true, 'Homepage rendered with theme toggle.');
    } finally {
        await context.close();
    }
};

const runFavoritesProbe = async (browser) => {
    const context = await createBypassedContext(browser);
    const page = await context.newPage();

    try {
        await loginViaProfile(page, authEmail, authPassword);
        const accessToken = await readSupabaseAccessToken(page);

        const response = await fetchWithBearer(page, '/api/favorites', accessToken, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                termId: 'term_001',
                shouldFavorite: false,
                idempotencyKey: crypto.randomUUID(),
            }),
        });

        if (response.status === 503 && response.body?.code === 'RATE_LIMITER_UNAVAILABLE') {
            throw new Error(
                'Preview runtime favorites write path returned RATE_LIMITER_UNAVAILABLE. ' +
                'Verify Vercel preview environment variables include UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
            );
        }

        assertCondition(
            response.status === 200 || response.status === 409,
            `Preview runtime favorites probe returned ${response.status}.`
        );

        recordCheck('favorites-write-probe', true, 'Authenticated favorites write path is reachable.');
    } finally {
        await context.close();
    }
};

const runSentryCapabilityProbe = async (browser) => {
    const context = await createBypassedContext(browser);
    const page = await context.newPage();

    try {
        await loginViaProfile(page, sentrySmokeEmail, sentrySmokePassword);
        const accessToken = await readSupabaseAccessToken(page);
        const response = await fetchWithBearer(page, '/api/auth/capabilities', accessToken, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        assertCondition(response.status === 200, `Preview runtime capabilities probe returned ${response.status}.`);
        assertCondition(
            typeof response.body?.isAdmin === 'boolean',
            'Preview runtime capabilities probe did not return a boolean isAdmin field.'
        );
        assertCondition(
            response.body.isAdmin === true,
            'Preview runtime smoke user is authenticated but not admin. Verify ADMIN_USER_IDS in the Vercel preview environment includes the SENTRY_SMOKE_EMAIL user id.'
        );

        recordCheck('sentry-capabilities-probe', true, 'Smoke user capabilities endpoint is reachable and returns admin=true.');
    } finally {
        await context.close();
    }
};

const printSummaryAndExit = () => {
    const failedChecks = checks.filter((check) => !check.passed);
    process.stdout.write(`${JSON.stringify({
        ok: failedChecks.length === 0,
        checks,
    }, null, 2)}\n`);

    if (failedChecks.length > 0) {
        process.exitCode = 1;
    }
};

const browser = await chromium.launch({ headless: true });

try {
    await runGuestCheck(browser);
    await runFavoritesProbe(browser);
    await runSentryCapabilityProbe(browser);
} catch (error) {
    recordCheck(
        'preview-runtime-check',
        false,
        error instanceof Error ? error.message : 'Unknown preview runtime check failure.'
    );
} finally {
    await browser.close();
    printSummaryAndExit();
}
