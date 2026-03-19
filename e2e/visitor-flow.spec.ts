import { test, expect, type Page } from '@playwright/test';
import { applyPreviewProtectionBypass, grantResearchConsent, waitForAppReady } from './support';

test.describe('Visitor Flow', () => {
    test('loads the homepage with the correct title', async ({ page }) => {
        await applyPreviewProtectionBypass(page);
        await grantResearchConsent(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);

        await expect(page).toHaveTitle(/FinTechTerms/);
    });

    test('searches for a term and finds results', async ({ page }) => {
        await applyPreviewProtectionBypass(page);
        await grantResearchConsent(page);
        await page.goto('/search', { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);

        await expect(page.getByTestId('search-input')).toBeVisible();
        await page.getByTestId('search-input').fill('bitcoin');
        await expect(page.getByText(/bitcoin/i).first()).toBeVisible();
    });

    test('persists category filters in the URL', async ({ page }) => {
        await applyPreviewProtectionBypass(page);
        await grantResearchConsent(page);
        await page.goto('/search', { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);

        const fintechCategoryChip = page.getByRole('button', { name: /^(fintech|финтех|fintek)$/i }).first();
        await page.locator('[data-testid="search-filter-toggle"]:visible').click();
        await fintechCategoryChip.click();

        await expect(page).toHaveURL(/category=Fintech/);
        await expect(fintechCategoryChip).toHaveAttribute('aria-pressed', 'true');
    });

    test('toggles theme from the homepage', async ({ page }) => {
        await applyPreviewProtectionBypass(page);
        await grantResearchConsent(page);
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);

        await page.locator('[data-testid="theme-toggle"]:visible').first().click();
        await expect(page.locator('html')).toHaveClass(/dark/);
    });
});
