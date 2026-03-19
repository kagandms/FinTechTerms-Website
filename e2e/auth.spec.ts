import { test, expect, type Page } from '@playwright/test';
import { applyPreviewProtectionBypass, grantResearchConsent, waitForAppReady } from './support';

test.describe('Authentication Flows', () => {
    test.beforeEach(async ({ page }) => {
        await applyPreviewProtectionBypass(page);
        await grantResearchConsent(page);
        await page.goto('/profile', { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);
    });

    test('shows the login modal and keeps it open for invalid credentials', async ({ page }) => {
        await page.getByTestId('open-auth-login').click();

        await expect(page.getByTestId('auth-modal')).toBeVisible();
        await page.getByTestId('auth-email').fill('invalid@example.com');
        await page.getByTestId('auth-password').fill('wrongpassword');
        await page.getByTestId('auth-submit').click();

        const authModal = page.getByTestId('auth-modal');
        await expect(authModal).toBeVisible();
        await expect(page.getByTestId('auth-submit')).toBeVisible();
    });

    test('navigates to forgot password mode', async ({ page }) => {
        await page.getByTestId('open-auth-login').click();
        await page.getByRole('button', { name: /forgot|забыли|şifre/i }).click();

        await expect(page.getByTestId('auth-email')).toBeVisible();
        await expect(page.getByRole('button', { name: /send|отправ|gönder/i })).toBeVisible();
    });

    test('shows register validation errors when required fields are missing', async ({ page }) => {
        await page.getByTestId('open-auth-register').click();

        await expect(page.getByTestId('auth-name')).toBeVisible();
        await page.getByTestId('auth-submit').click();

        await expect(page.getByText(/required|обяз|gerek/i).first()).toBeVisible();
    });
});
