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
    await page.context().clearCookies();
    await applyPreviewProtectionBypass(page);
    await grantResearchConsent(page);
    await page.goto('/profile?auth=login', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(page.getByTestId('auth-modal')).toBeVisible({ timeout: 20_000 });

    await page.evaluate(({ nextEmail, nextPassword }) => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/auth/login/browser';
        form.style.display = 'none';

        const appendHiddenInput = (name: string, value: string) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value;
            form.appendChild(input);
        };

        appendHiddenInput('email', nextEmail);
        appendHiddenInput('password', nextPassword);
        appendHiddenInput('redirectTo', '/profile');

        document.body.appendChild(form);
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
            return;
        }

        form.submit();
    }, {
        nextEmail: email,
        nextPassword: password,
    });

    await page.waitForURL(/\/profile(?:\?.*)?$/, { timeout: 20_000 });

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await waitForAppReady(page);

        const currentUrl = new URL(page.url());
        const authError = currentUrl.searchParams.get('authError');
        expect(authError, `Browser login redirect returned authError=${authError}`).toBeNull();

        const hasAvatar = await page.getByTestId('user-avatar').isVisible().catch(() => false);
        if (hasAvatar) {
            return;
        }

        if (attempt < 2) {
            await page.reload({ waitUntil: 'domcontentloaded' });
        }
    }

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
