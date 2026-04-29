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

async function loginViaProfile(page: Page, email: string, password: string) {
    const logoutButton = page.getByRole('button', {
        name: /Выйти|Logout|Sign out|Çıkış/i,
    });

    await page.context().clearCookies();
    await page.addInitScript(() => {
        for (const key of Object.keys(window.localStorage)) {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                window.localStorage.removeItem(key);
            }
        }

        window.sessionStorage.clear();
    });
    await applyPreviewProtectionBypass(page);
    await grantResearchConsent(page);
    await page.goto('/profile?auth=login', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    if (await logoutButton.isVisible().catch(() => false)) {
        return;
    }

    const authModal = page.getByTestId('auth-modal');

    if (!await authModal.isVisible().catch(() => false)) {
        const loginButton = page.getByTestId('open-auth-login');
        await expect(loginButton).toBeVisible({ timeout: 20_000 });
        await loginButton.click({ force: true });
    }

    await expect(authModal).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('auth-email').fill(email);
    await page.getByTestId('auth-password').fill(password);
    await page.getByTestId('auth-submit').click();
    await page.waitForURL(/\/profile(?:\?.*)?$/, { timeout: 20_000 }).catch(() => undefined);

    try {
        await expect(logoutButton).toBeVisible({ timeout: 20_000 });
    } catch (error) {
        const authErrorText = await page.getByTestId('auth-error').textContent().catch(() => null);
        if (authErrorText?.trim()) {
            throw new Error(`Interactive login failed: ${authErrorText.trim()}`);
        }

        throw error;
    }
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
