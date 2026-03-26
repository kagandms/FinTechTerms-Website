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

    await page.evaluate((seedPayload) => {
        const nowIso = new Date().toISOString();
        const termsKey = 'globalfinterm_terms';
        const progressKey = `globalfinterm_user_progress:auth:${seedPayload.userId}`;
        const rawTerms = window.localStorage.getItem(termsKey);

        if (rawTerms) {
            const parsedTerms = JSON.parse(rawTerms);
            if (Array.isArray(parsedTerms)) {
                const seededDueIds = new Set(seedPayload.seededDueTerms);
                const updatedTerms = parsedTerms.map((term) => {
                    if (!term || typeof term !== 'object' || !seededDueIds.has(term.id)) {
                        return term;
                    }

                    return {
                        ...term,
                        srs_level: 1,
                        next_review_date: new Date(Date.now() - (60 * 60 * 1000)).toISOString(),
                        last_reviewed: null,
                        difficulty_score: 2.5,
                        retention_rate: 0,
                        times_reviewed: 0,
                        times_correct: 0,
                    };
                });

                window.localStorage.setItem(termsKey, JSON.stringify(updatedTerms));
            }
        }

        window.localStorage.setItem(progressKey, JSON.stringify({
            user_id: seedPayload.userId,
            favorites: seedPayload.seededFavorites,
            current_language: 'ru',
            quiz_history: [],
            total_words_learned: 0,
            current_streak: 0,
            last_study_date: null,
            created_at: nowIso,
            updated_at: nowIso,
        }));
    }, payload);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
};

const ensureSeededFavorites = async (page: Page, minimumCount: number) => {
    await seedStudyState(page, minimumCount);
    await page.goto('/favorites?from=profile', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(page.getByTestId('favorite-button').first()).toBeVisible();
};

test.describe('@auth-required Authenticated happy path', () => {
    test.skip(
        !process.env.E2E_AUTH_EMAIL || !process.env.E2E_AUTH_PASSWORD || !process.env.E2E_SEED_SECRET,
        'Authenticated E2E requires E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, and E2E_SEED_SECRET.'
    );

    test('loads authenticated favorites, opens profile editing, and reaches quiz surfaces', async ({ authenticatedPage: page }) => {
        await ensureSeededFavorites(page, 2);

        await navigateWithinApp(page, '/favorites');
        await expect(page.getByTestId('favorite-button').first()).toBeVisible();

        await navigateWithinApp(page, '/profile');
        await page.getByTestId('profile-edit-toggle').click({ force: true });

        const nameInput = page.getByTestId('profile-name');
        await expect(nameInput).toBeVisible();

        const currentName = (await nameInput.inputValue()).trim();
        const effectiveName = currentName.length > 0 ? currentName : 'Playwright';
        const nextName = effectiveName === 'Playwright'
            ? 'Playwright QA'
            : 'Playwright';

        await nameInput.fill(nextName);
        await page.getByTestId('profile-save').click({ force: true });
        await page.waitForTimeout(1000);

        await navigateWithinApp(page, '/quiz');
        await expect(page.getByRole('heading', { name: /Практика|Practice|Quiz/i }).first()).toBeVisible();
        await expect(page.getByTestId('due-card-count')).toContainText(/\d+/);
    });
});
