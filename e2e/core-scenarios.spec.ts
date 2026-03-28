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

                for (const candidate of candidates) {
                    if (!isVisible(candidate)) {
                        continue;
                    }

                    if (pattern.test(candidate.textContent ?? '')) {
                        return candidate;
                    }
                }

                return null;
            };

            const intersects = (left: DOMRect, right: DOMRect): boolean => (
                left.left < right.right
                && left.right > right.left
                && left.top < right.bottom
                && left.bottom > right.top
            );

            const title = findVisibleByText('h1', /FinTechTerms/);
            const subtitle = findVisibleByText('p', /Словарь экономики и ИТ TR-EN-RU/);
            const languageButton = findVisibleByText('button', /Русский/);
            const installButton = findVisibleByText('button, a', /Установить/);

            if (!title || !subtitle || !languageButton) {
                return {
                    hasAllTargets: false,
                    overlaps: true,
                };
            }

            const rects = [
                title.getBoundingClientRect(),
                subtitle.getBoundingClientRect(),
                languageButton.getBoundingClientRect(),
                ...(installButton ? [installButton.getBoundingClientRect()] : []),
            ];
            let overlaps = false;

            for (let leftIndex = 0; leftIndex < rects.length; leftIndex += 1) {
                const leftRect = rects[leftIndex];
                if (!leftRect) {
                    continue;
                }

                for (let rightIndex = leftIndex + 1; rightIndex < rects.length; rightIndex += 1) {
                    const rightRect = rects[rightIndex];
                    if (!rightRect || !intersects(leftRect, rightRect)) {
                        continue;
                    }

                    overlaps = true;
                }
            }

            return { hasAllTargets: true, overlaps };
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
        await expect(page.getByText(/membership|участникам|üyelik/i).first()).toBeVisible();
        await expect(page.getByRole('link', { name: /profile|профил|profil/i }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /quick|быстрый|hızlı/i }).first()).toBeVisible();
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
