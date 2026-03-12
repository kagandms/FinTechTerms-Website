import { test, expect, type Page } from '@playwright/test';
import { applyPreviewProtectionBypass, grantResearchConsent, waitForAppReady } from './support';

const readDueCount = async (page: Page) => {
    const text = await page.getByTestId('due-card-count').first().textContent();
    return Number.parseInt((text || '0').trim(), 10) || 0;
};

test.describe('Core Scenarios (Visitor)', () => {
    test('shows the empty review state for a new visitor', async ({ page }) => {
        await applyPreviewProtectionBypass(page);
        await grantResearchConsent(page);
        await page.goto('/quiz', { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);

        await expect.poll(async () => readDueCount(page)).toBe(0);
        await expect(page.getByText(/add|favori|избран/i).first()).toBeVisible();
    });

    test('lets a guest favorite a visible term', async ({ page }) => {
        await applyPreviewProtectionBypass(page);
        await grantResearchConsent(page);
        await page.goto('/search', { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);

        const favoriteButtons = page.getByTestId('favorite-button');
        const favoriteButtonCount = await favoriteButtons.count();
        let favoriteButton = favoriteButtons.first();

        for (let index = 0; index < favoriteButtonCount; index += 1) {
            const candidate = favoriteButtons.nth(index);
            const isPressed = await candidate.getAttribute('aria-pressed');

            if (isPressed === 'false') {
                favoriteButton = candidate;
                break;
            }
        }

        await expect(favoriteButton).toBeVisible();

        await favoriteButton.click();
        await expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
    });
});
