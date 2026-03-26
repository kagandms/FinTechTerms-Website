import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';
import { waitForAppReady } from './support';

const getRequiredEnv = (name: string): string => {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required E2E environment variable: ${name}`);
    }

    return value;
};

const readDueCount = async (page: Page) => {
    const text = await page.getByTestId('due-card-count').first().textContent();
    return Number.parseInt((text || '0').trim(), 10) || 0;
};

const navigationLabels: Record<'/' | '/quiz' | '/profile' | '/favorites', RegExp> = {
    '/': /Главная|Home/i,
    '/quiz': /Практика|Practice|Quiz/i,
    '/profile': /Профиль|Profile/i,
    '/favorites': /Избранное|Favorites/i,
};

const navigateWithinApp = async (page: Page, href: '/' | '/quiz' | '/profile' | '/favorites') => {
    const navigationLink = page.getByRole('link', { name: navigationLabels[href] }).last();
    await navigationLink.click();
    await expect(page).toHaveURL(new RegExp(`${href === '/' ? '/$' : `${href.replace('/', '\\/')}(?:\\?.*)?$`}`), {
        timeout: 20_000,
    });
    await waitForAppReady(page);
};

const seedStudyState = async (page: Page, minimumCount: number) => {
    const seededTermIds = ['term_001', 'term_003'].slice(0, minimumCount);
    const response = await page.request.post('/api/test/e2e/seed-study-state', {
        headers: {
            'Content-Type': 'application/json',
            'x-e2e-seed-secret': getRequiredEnv('E2E_SEED_SECRET'),
        },
        data: {
            userEmail: getRequiredEnv('E2E_AUTH_EMAIL'),
            favoriteTermIds: seededTermIds,
            dueTermIds: seededTermIds,
            clearExistingFavorites: true,
            clearExistingQuizHistory: true,
        },
    });

    const payload = await response.json();
    const responseSummary = JSON.stringify({
        status: response.status(),
        payload,
    });
    expect(response.ok(), responseSummary).toBe(true);
    expect(payload.seededDueTerms).toHaveLength(seededTermIds.length);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
};

const ensureMinimumDueCards = async (page: Page, minimumCount: number) => {
    await seedStudyState(page, minimumCount);
    await page.goto('/quiz', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const dueCount = await readDueCount(page);

    expect(dueCount).toBeGreaterThanOrEqual(minimumCount);
    return dueCount;
};

test.describe('@auth-required Authenticated happy path', () => {
    test.skip(
        !process.env.E2E_AUTH_EMAIL || !process.env.E2E_AUTH_PASSWORD || !process.env.E2E_SEED_SECRET,
        'Authenticated E2E requires E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, and E2E_SEED_SECRET.'
    );

    test('favorites a term, saves a profile edit, and persists quiz progress', async ({ authenticatedPage: page }) => {
        const dueBeforeQuiz = await ensureMinimumDueCards(page, 2);

        await navigateWithinApp(page, '/favorites');
        await expect(page.getByTestId('favorite-button').first()).toBeVisible();

        await navigateWithinApp(page, '/profile');
        await page.getByTestId('profile-edit-toggle').click();

        const nameInput = page.getByTestId('profile-name');
        await expect(nameInput).toBeVisible();

        const currentName = (await nameInput.inputValue()).trim();
        expect(currentName.length).toBeGreaterThan(0);
        const nextName = currentName === 'Playwright'
            ? 'Playwright QA'
            : 'Playwright';

        await nameInput.fill(nextName);
        await page.getByTestId('profile-save').click();
        await expect(nameInput).toHaveValue(nextName);

        await navigateWithinApp(page, '/quiz');
        await expect.poll(async () => readDueCount(page)).toBeGreaterThanOrEqual(2);

        await page.getByTestId('start-srs-review').click();
        await page.getByRole('button', { name: /show answer|показать ответ/i }).click();
        await expect(page.getByTestId('quiz-answer-btn').first()).toBeVisible();
        await page.getByTestId('quiz-answer-btn').first().click();

        await navigateWithinApp(page, '/quiz');
        await expect.poll(async () => readDueCount(page), { timeout: 20_000 }).toBeLessThan(dueBeforeQuiz);
    });
});
