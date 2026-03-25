import { test, expect, type Page } from '@playwright/test';
import { applyPreviewProtectionBypass, grantResearchConsent, waitForAppReady } from './support';

const readDueCount = async (page: Page) => {
    const text = await page.getByTestId('due-card-count').first().textContent();
    return Number.parseInt((text || '0').trim(), 10) || 0;
};

test.describe('Core Scenarios (Visitor)', () => {
    test('keeps the Russian desktop home hero stable on first load', async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('globalfinterm_language', 'ru');
        });
        await page.setViewportSize({ width: 1440, height: 1100 });
        await applyPreviewProtectionBypass(page);
        await grantResearchConsent(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);

        const layoutState = await page.evaluate(() => {
            const isVisible = (value: Element | null): value is HTMLElement => (
                value instanceof HTMLElement
                && value.getClientRects().length > 0
            );

            const findVisibleByText = (selector: string, pattern: RegExp): HTMLElement | null => {
                const candidates = Array.from(document.querySelectorAll(selector));
                return candidates.find((candidate) => isVisible(candidate) && pattern.test(candidate.textContent ?? '')) ?? null;
            };

            const intersects = (left: DOMRect, right: DOMRect): boolean => (
                left.left < right.right
                && left.right > right.left
                && left.top < right.bottom
                && left.bottom > right.top
            );

            const title = findVisibleByText('h1', /FinTechTerms/);
            const subtitle = findVisibleByText('p', /Словарь экономики и ИТ TR-EN-RU/);
            const installButton = findVisibleByText('button, a', /Установить/);
            const languageButton = findVisibleByText('button', /Русский/);

            if (!title || !subtitle || !installButton || !languageButton) {
                return {
                    hasAllTargets: false,
                    overlaps: true,
                };
            }

            const titleRect = title.getBoundingClientRect();
            const subtitleRect = subtitle.getBoundingClientRect();
            const installRect = installButton.getBoundingClientRect();
            const languageRect = languageButton.getBoundingClientRect();

            return {
                hasAllTargets: true,
                overlaps: intersects(titleRect, installRect)
                    || intersects(titleRect, languageRect)
                    || intersects(subtitleRect, installRect)
                    || intersects(subtitleRect, languageRect),
            };
        });

        expect(layoutState.hasAllTargets).toBe(true);
        expect(layoutState.overlaps).toBe(false);
    });

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
