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

const LOGIN_BASE_URL = 'http://127.0.0.1:3000';

const parseSetCookieHeader = (headerValue: string) => {
    const [nameValue, ...attributeParts] = headerValue.split(';').map((part) => part.trim());
    const separatorIndex = nameValue.indexOf('=');

    if (separatorIndex <= 0) {
        return null;
    }

    const cookie = {
        name: nameValue.slice(0, separatorIndex),
        value: nameValue.slice(separatorIndex + 1),
        url: LOGIN_BASE_URL,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
        expires: -1,
    };

    attributeParts.forEach((attributePart) => {
        const [rawKey, ...rawValueParts] = attributePart.split('=');
        const key = rawKey?.trim().toLowerCase();
        const value = rawValueParts.join('=').trim();

        if (key === 'expires' && value) {
            const timestamp = Date.parse(value);
            if (!Number.isNaN(timestamp)) {
                cookie.expires = Math.floor(timestamp / 1000);
            }
            return;
        }

        if (key === 'max-age' && value) {
            const seconds = Number.parseInt(value, 10);
            if (!Number.isNaN(seconds)) {
                cookie.expires = Math.floor(Date.now() / 1000) + seconds;
            }
            return;
        }

        if (key === 'httponly') {
            cookie.httpOnly = true;
            return;
        }

        if (key === 'secure') {
            cookie.secure = true;
            return;
        }

        if (key === 'samesite' && value) {
            if (value === 'Strict' || value === 'Lax' || value === 'None') {
                cookie.sameSite = value;
            }
        }
    });

    return cookie;
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
        failOnStatusCode: false,
    });

    expect(loginResponse.ok()).toBeTruthy();
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
