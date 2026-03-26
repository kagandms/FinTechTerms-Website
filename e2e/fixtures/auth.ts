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
    await applyPreviewProtectionBypass(page);
    await grantResearchConsent(page);
    await page.goto('/profile?auth=login', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    if (await page.getByTestId('user-avatar').isVisible().catch(() => false)) {
        return;
    }

    const authModal = page.getByTestId('auth-modal');

    if (!await authModal.isVisible().catch(() => false)) {
        await page.getByTestId('open-auth-login').click({ force: true });
    }

    await expect(authModal).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('auth-email').fill(email);
    await page.getByTestId('auth-password').fill(password);
    await page.getByTestId('auth-submit').click();

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
