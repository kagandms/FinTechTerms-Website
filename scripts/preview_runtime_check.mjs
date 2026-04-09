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

const readOptionalCredentialPair = (emailKey, passwordKey) => {
    const email = optionalEnv(emailKey);
    const password = optionalEnv(passwordKey);

    if ((email && !password) || (!email && password)) {
        throw new Error(`Set both ${emailKey} and ${passwordKey}, or neither.`);
    }

    if (!email || !password) {
        return null;
    }

    return { email, password };
};

const stagingBaseUrl = requiredEnv('STAGING_BASE_URL').replace(/\/$/, '');
const e2eAuthCredentials = {
    email: requiredEnv('E2E_AUTH_EMAIL'),
    password: requiredEnv('E2E_AUTH_PASSWORD'),
};
const smokeAuthCredentials = readOptionalCredentialPair('SMOKE_AUTH_EMAIL', 'SMOKE_AUTH_PASSWORD');
const sentrySmokeCredentials = {
    email: requiredEnv('SENTRY_SMOKE_EMAIL'),
    password: requiredEnv('SENTRY_SMOKE_PASSWORD'),
};
const memberProbeCredentials = smokeAuthCredentials || sentrySmokeCredentials;
const memberProbeCredentialSource = smokeAuthCredentials ? 'SMOKE_AUTH_EMAIL' : 'SENTRY_SMOKE_EMAIL';
const vercelAutomationBypassSecret = optionalEnv('VERCEL_AUTOMATION_BYPASS_SECRET');
const NETWORK_IDLE_TIMEOUT_MS = 10_000;

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
        // Preview runtimes can keep background requests open after the UI is already interactive.
    }

    await page.waitForTimeout(500);
};

const readPageDebugState = async (page) => ({
    url: page.url(),
    title: await page.title(),
    hasAuthModal: await page.getByTestId('auth-modal').isVisible().catch(() => false),
    hasLoginButton: await page.getByTestId('open-auth-login').isVisible().catch(() => false),
    hasRegisterButton: await page.getByTestId('open-auth-register').isVisible().catch(() => false),
    hasAvatar: await page.getByTestId('user-avatar').isVisible().catch(() => false),
    bodySnippet: (await page.locator('body').innerText().catch(() => ''))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300),
});

const loginViaProfile = async (page, email, password) => {
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
    } catch (error) {
        const debugState = await readPageDebugState(page);
        throw new Error(
            `Authentication modal did not become visible. Debug: ${JSON.stringify(debugState)}`
        );
    }

    await page.getByTestId('auth-email').fill(email);
    await page.getByTestId('auth-password').fill(password);
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
                // Ignore malformed local storage entries during runtime probing.
            }
        }

        return null;
    })
);

const fetchWithBearer = async (page, path, token, init = {}) => (
    await page.evaluate(async ({ routePath, bearerToken, requestInit }) => {
        const response = await fetch(routePath, {
            ...requestInit,
            credentials: 'same-origin',
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

const fetchJson = async (page, path, init = {}) => (
    await page.evaluate(async ({ routePath, requestInit }) => {
        const response = await fetch(routePath, {
            credentials: 'same-origin',
            ...requestInit,
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
        requestInit: init,
    })
);

const fetchAuthenticatedJson = async (page, path, init = {}) => {
    const cookieResponse = await fetchJson(page, path, init);

    if (cookieResponse.status !== 401) {
        return cookieResponse;
    }

    const accessToken = await resolveSupabaseAccessTokenFromStorage(page);
    if (!accessToken) {
        return cookieResponse;
    }

    return await fetchWithBearer(page, path, accessToken, init);
};

const runGuestCheck = async (browser) => {
    const context = await createBypassedContext(browser);
    const page = await context.newPage();

    try {
        await grantResearchConsent(page);
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
        await grantResearchConsent(page);
        await loginViaProfile(page, e2eAuthCredentials.email, e2eAuthCredentials.password);
        const response = await fetchAuthenticatedJson(page, '/api/favorites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                termId: 'term_001',
                shouldFavorite: true,
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

        recordCheck('favorites-write-probe', true, 'Authenticated favorites add path is reachable.');
    } finally {
        await context.close();
    }
};

const runStudySessionsProbe = async (browser) => {
    const context = await createBypassedContext(browser);
    const page = await context.newPage();

    try {
        await grantResearchConsent(page);
        await page.goto(`${stagingBaseUrl}/`, { waitUntil: 'domcontentloaded' });
        await waitForPageSettle(page);

        const startResponse = await fetchJson(page, '/api/study-sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'start',
                anonymousId: `preview-probe-${crypto.randomUUID()}`,
                deviceType: 'desktop',
                userAgent: 'preview-runtime-check',
                consentGiven: true,
                idempotency_key: crypto.randomUUID(),
            }),
        });

        if (startResponse.status === 503 && startResponse.body?.code === 'STUDY_SESSION_DISABLED') {
            throw new Error(
                'Preview runtime study-sessions route is disabled. ' +
                'Verify Vercel preview environment variables include STUDY_SESSION_TOKEN_SECRET.'
            );
        }

        if (startResponse.status === 503 && startResponse.body?.code === 'RATE_LIMITER_UNAVAILABLE') {
            throw new Error(
                'Preview runtime study-sessions route returned RATE_LIMITER_UNAVAILABLE. ' +
                'Verify Vercel preview environment variables include UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
            );
        }

        assertCondition(startResponse.status === 200, `Preview runtime study-session start returned ${startResponse.status}.`);
        assertCondition(
            typeof startResponse.body?.sessionId === 'string' && startResponse.body.sessionId.length > 0,
            'Preview runtime study-session start did not return a sessionId field.'
        );
        assertCondition(
            typeof startResponse.body?.sessionToken === 'string' && startResponse.body.sessionToken.length > 0,
            'Preview runtime study-session start did not return a sessionToken field.'
        );

        const endResponse = await fetchJson(page, '/api/study-sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'end',
                sessionId: startResponse.body.sessionId,
                sessionToken: startResponse.body.sessionToken,
                durationSeconds: 1,
                pageViews: 1,
                quizAttempts: 0,
                idempotency_key: crypto.randomUUID(),
            }),
        });

        assertCondition(endResponse.status === 200, `Preview runtime study-session end returned ${endResponse.status}.`);
        assertCondition(endResponse.body?.success === true, 'Preview runtime study-session end did not return success=true.');

        recordCheck('study-sessions-probe', true, 'Anonymous study-session start/end path is reachable.');
    } finally {
        await context.close();
    }
};

const runAiChatProbe = async (browser) => {
    const context = await createBypassedContext(browser);
    const page = await context.newPage();

    try {
        await grantResearchConsent(page);
        await page.goto(`${stagingBaseUrl}/`, { waitUntil: 'domcontentloaded' });
        await waitForPageSettle(page);

        const guestResponse = await fetchJson(page, '/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                language: 'en',
                message: 'What is Bitcoin?',
                history: [],
            }),
        });

        if (guestResponse.status === 503 && guestResponse.body?.code === 'RATE_LIMITER_UNAVAILABLE') {
            throw new Error(
                'Preview runtime AI route returned RATE_LIMITER_UNAVAILABLE. ' +
                'Verify Vercel preview environment variables include UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
            );
        }

        assertCondition(
            guestResponse.status === 401,
            `Preview runtime guest AI chat returned ${guestResponse.status}.`
        );
        assertCondition(
            guestResponse.body?.code === 'UNAUTHORIZED',
            'Preview runtime guest AI chat did not return the UNAUTHORIZED guard response.'
        );

        await loginViaProfile(page, memberProbeCredentials.email, memberProbeCredentials.password);
        const memberResponse = await fetchAuthenticatedJson(page, '/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                language: 'en',
                message: 'What is Bitcoin?',
                history: [],
            }),
        });

        if (memberResponse.status === 503 && memberResponse.body?.code === 'RATE_LIMITER_UNAVAILABLE') {
            throw new Error(
                'Preview runtime AI route returned RATE_LIMITER_UNAVAILABLE. ' +
                'Verify Vercel preview environment variables include UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
            );
        }

        if (memberResponse.status === 403 && memberResponse.body?.code === 'MEMBER_REQUIRED') {
            throw new Error(
                'Preview runtime AI chat denied the configured member probe user with MEMBER_REQUIRED. ' +
                `Verify ${memberProbeCredentialSource} belongs to a full member with completed profile setup.`
            );
        }

        assertCondition(memberResponse.status === 200, `Preview runtime member AI chat returned ${memberResponse.status}.`);
        assertCondition(
            memberResponse.body?.degraded !== true,
            'Preview runtime AI chat is serving degraded fallback responses. ' +
            'Verify OpenRouter provider configuration and model availability.'
        );
        assertCondition(
            typeof memberResponse.body?.answer === 'string' && memberResponse.body.answer.length > 0,
            'Preview runtime AI chat did not return an answer.'
        );
        assertCondition(
            typeof memberResponse.body?.model === 'string' && memberResponse.body.model.length > 0,
            'Preview runtime AI chat did not report a serving model.'
        );

        recordCheck(
            'ai-chat-probe',
            true,
            'AI chat route rejects guests and serves a real model response for the authenticated member probe.'
        );
    } finally {
        await context.close();
    }
};

const runSentryCapabilityProbe = async (browser) => {
    const context = await createBypassedContext(browser);
    const page = await context.newPage();

    try {
        await grantResearchConsent(page);
        await loginViaProfile(page, sentrySmokeCredentials.email, sentrySmokeCredentials.password);
        const response = await fetchAuthenticatedJson(page, '/api/auth/capabilities', {
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
    await runStudySessionsProbe(browser);
    await runAiChatProbe(browser);
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
