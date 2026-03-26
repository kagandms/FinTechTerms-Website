import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';
import { waitForAppReady } from './support';

const navigateToRoute = async (page: Page, href: string) => {
    await page.goto(href, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
};

test.describe('@auth-required Authenticated happy path', () => {
    test.skip(
        !process.env.E2E_AUTH_EMAIL || !process.env.E2E_AUTH_PASSWORD,
        'Authenticated E2E requires E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD.'
    );

    test('loads authenticated profile, favorites, and quiz surfaces', async ({ authenticatedPage: page }) => {
        await waitForAppReady(page);
        await expect(page).toHaveURL(/\/profile(?:\?.*)?$/);
        await expect(page.getByTestId('user-avatar')).toBeVisible();
        await expect(page.getByTestId('open-auth-login')).toHaveCount(0);
        await expect(page.getByRole('heading', {
            name: /Профиль|Profile/i,
        }).first()).toBeVisible();

        await navigateToRoute(page, '/favorites?from=profile');
        await expect(page).toHaveURL(/\/favorites(?:\?.*)?$/);
        await expect(page.getByRole('heading', {
            name: /Избранные|Мои избранные|Favorites|My Favorites/i,
        }).first()).toBeVisible();

        await navigateToRoute(page, '/quiz');
        await expect(page).toHaveURL(/\/quiz(?:\?.*)?$/);
        await expect(page.getByRole('heading', {
            name: /Практика|Practice|Quiz/i,
        }).first()).toBeVisible();
        await expect(page.getByTestId('due-card-count')).toBeVisible();
    });
});
