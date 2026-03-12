import { chromium } from '@playwright/test';

const requiredEnv = (name) => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

const optionalEnv = (name) => process.env[name]?.trim() || null;

const stagingBaseUrl = requiredEnv('STAGING_BASE_URL').replace(/\/$/, '');
const adminEmail = optionalEnv('ADMIN_EMAIL');
const smokeAuthEmail = optionalEnv('SMOKE_AUTH_EMAIL') || optionalEnv('E2E_AUTH_EMAIL');
const smokeAuthPassword = optionalEnv('SMOKE_AUTH_PASSWORD') || optionalEnv('E2E_AUTH_PASSWORD');
const sentrySmokeEmail = optionalEnv('SENTRY_SMOKE_EMAIL') || smokeAuthEmail;
const sentrySmokePassword = optionalEnv('SENTRY_SMOKE_PASSWORD') || smokeAuthPassword;
const vercelAutomationBypassSecret = optionalEnv('VERCEL_AUTOMATION_BYPASS_SECRET');

const smokeChecks = [];

const recordCheck = (name, passed, detail) => {
    smokeChecks.push({ name, passed, detail });
};

const assertCondition = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

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
    await page.waitForLoadState('networkidle');
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
    await page.getByTestId('search-input').fill('3D');
    await page.getByText(/3D/i).first().waitFor({ state: 'visible' });
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
    await page.goto(`${stagingBaseUrl}/profile`, { waitUntil: 'domcontentloaded' });
    await waitForPageSettle(page);

    if (await page.getByTestId('user-avatar').isVisible().catch(() => false)) {
        return;
    }

    await page.getByTestId('open-auth-login').click();
    await page.getByTestId('auth-modal').waitFor({ state: 'visible' });
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

const runSentrySmoke = async (page) => {
    if (!adminEmail || !sentrySmokeEmail || !sentrySmokePassword) {
        throw new Error('Admin Sentry smoke requires ADMIN_EMAIL, SENTRY_SMOKE_EMAIL, and SENTRY_SMOKE_PASSWORD.');
    }

    if (sentrySmokeEmail !== adminEmail) {
        throw new Error('SENTRY_SMOKE_EMAIL must match ADMIN_EMAIL for the admin-only Sentry smoke route.');
    }

    await loginViaProfile(page, sentrySmokeEmail, sentrySmokePassword);
    const accessToken = await readSupabaseAccessToken(page);

    const response = await page.evaluate(async (token) => {
        const result = await fetch('/api/admin/sentry-smoke', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        return {
            status: result.status,
            body: await result.json(),
        };
    }, accessToken);

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
const context = await browser.newContext({
    extraHTTPHeaders: vercelAutomationBypassSecret
        ? {
            'x-vercel-protection-bypass': vercelAutomationBypassSecret,
            'x-vercel-set-bypass-cookie': 'true',
        }
        : undefined,
});
const page = await context.newPage();

try {
    await grantResearchConsent(page);
    await runGuestSmoke(page);
    await runAuthenticatedSmoke(page);
    await runSentrySmoke(page);
} catch (error) {
    recordCheck('staging-smoke', false, error instanceof Error ? error.message : 'Unknown staging smoke failure.');
} finally {
    await context.close();
    await browser.close();
    printSummaryAndExit();
}
