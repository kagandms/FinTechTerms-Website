import { test as base, expect, type Page } from '@playwright/test';
import { applyPreviewProtectionBypass, grantResearchConsent, waitForAppReady } from '../support';

type AuthFixtures = {
    authenticatedPage: Page;
};

const getRequiredEnv = (name: string): string => {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required E2E environment variable: ${name}`);
    }

    return value;
};

const LOGIN_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const LOGIN_BASE_ORIGIN = new URL(LOGIN_BASE_URL).origin;

const getPreviewBypassHeaders = (): Record<string, string> => {
    const automationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    if (!automationBypassSecret) {
        return {};
    }

    return {
        'x-vercel-protection-bypass': automationBypassSecret,
        'x-vercel-set-bypass-cookie': 'true',
    };
};

type ParsedBrowserCookie = {
    name: string;
    value: string;
    url: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
    expires: number;
};

const parseSetCookieHeader = (headerValue: string): ParsedBrowserCookie | null => {
    const [nameValue, ...attributeParts] = headerValue.split(';').map((part) => part.trim());
    if (!nameValue) {
        return null;
    }

    const separatorIndex = nameValue.indexOf('=');

    if (separatorIndex <= 0) {
        return null;
    }

    let expires = -1;
    let httpOnly = false;
    let secure = false;
    let sameSite: ParsedBrowserCookie['sameSite'] = 'Lax';

    attributeParts.forEach((attributePart) => {
        const [rawKey, ...rawValueParts] = attributePart.split('=');
        const key = rawKey?.trim().toLowerCase();
        const value = rawValueParts.join('=').trim();

        if (key === 'expires' && value) {
            const timestamp = Date.parse(value);
            if (!Number.isNaN(timestamp)) {
                expires = Math.floor(timestamp / 1000);
            }
            return;
        }

        if (key === 'max-age' && value) {
            const seconds = Number.parseInt(value, 10);
            if (!Number.isNaN(seconds)) {
                expires = Math.floor(Date.now() / 1000) + seconds;
            }
            return;
        }

        if (key === 'httponly') {
            httpOnly = true;
            return;
        }

        if (key === 'secure') {
            secure = true;
            return;
        }

        if (key === 'samesite' && value) {
            if (value === 'Strict' || value === 'Lax' || value === 'None') {
                sameSite = value;
            }
        }
    });

    return {
        name: nameValue.slice(0, separatorIndex),
        value: nameValue.slice(separatorIndex + 1),
        url: LOGIN_BASE_ORIGIN,
        httpOnly,
        secure,
        sameSite,
        expires,
    };
};

async function loginViaProfile(page: Page, email: string, password: string) {
    await page.context().clearCookies();
    await applyPreviewProtectionBypass(page);
    await grantResearchConsent(page);
    const loginResponse = await page.context().request.post('/api/auth/login', {
        data: {
            email,
            password,
        },
        headers: {
            Origin: LOGIN_BASE_ORIGIN,
            Referer: `${LOGIN_BASE_ORIGIN}/profile?auth=login`,
            ...getPreviewBypassHeaders(),
        },
        failOnStatusCode: false,
    });

    const loginResponseBody = await loginResponse.json().catch(() => null);

    expect(
        loginResponse.ok(),
        `Login failed with status ${loginResponse.status()}: ${JSON.stringify(loginResponseBody)}`
    ).toBeTruthy();
    const cookies = loginResponse
        .headersArray()
        .filter((header) => header.name.toLowerCase() === 'set-cookie')
        .map((header) => parseSetCookieHeader(header.value))
        .filter((cookie): cookie is NonNullable<ReturnType<typeof parseSetCookieHeader>> => cookie !== null);

    if (cookies.length > 0) {
        await page.context().addCookies(cookies);
    }

    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(page.getByTestId('user-avatar')).toBeVisible({ timeout: 20_000 });
}

export const test = base.extend<AuthFixtures>({
    authenticatedPage: async ({ page }, use) => {
        await loginViaProfile(
            page,
            getRequiredEnv('E2E_AUTH_EMAIL'),
            getRequiredEnv('E2E_AUTH_PASSWORD')
        );
        await use(page);
    },
});

export { expect };
