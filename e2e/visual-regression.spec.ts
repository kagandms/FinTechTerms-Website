import { expect, test, type Page } from '@playwright/test';
import { applyPreviewProtectionBypass, grantResearchConsent, waitForAppReady } from './support';

const SCREENSHOT_PATHS = [
    { path: '/', slug: 'home' },
    { path: '/dashboard', slug: 'dashboard' },
    { path: '/profile', slug: 'profile' },
    { path: '/search?q=bitcoin', slug: 'search' },
    { path: '/quiz', slug: 'quiz' },
    { path: '/favorites', slug: 'favorites' },
] as const;

const installVisualStabilizers = async (page: Page, theme: 'light' | 'dark'): Promise<void> => {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((preferredTheme) => {
        window.localStorage.setItem('theme', preferredTheme);
        window.localStorage.setItem('globalfinterm_language', 'en');

        const consent = {
            given: true,
            timestamp: '2026-03-11T00:00:00.000Z',
            version: '1.0',
        };

        window.localStorage.setItem('fintechterms_research_consent', JSON.stringify(consent));
        Math.random = () => 0.123456789;
    }, theme);
};

for (const screenshotRoute of SCREENSHOT_PATHS) {
    for (const theme of ['light', 'dark'] as const) {
        test(`${screenshotRoute.slug} matches the ${theme} visual baseline`, async ({ page }) => {
            await installVisualStabilizers(page, theme);
            await applyPreviewProtectionBypass(page);
            await grantResearchConsent(page);
            await page.goto(screenshotRoute.path, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);

            await expect(page).toHaveScreenshot(`${screenshotRoute.slug}-${theme}.png`, {
                animations: 'disabled',
                caret: 'hide',
                maxDiffPixelRatio: 0.01,
            });
        });
    }
}
