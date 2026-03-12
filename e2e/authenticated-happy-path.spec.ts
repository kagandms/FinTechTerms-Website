import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';
import { waitForAppReady } from './support';

const readDueCount = async (page: Page) => {
    const text = await page.getByTestId('due-card-count').first().textContent();
    return Number.parseInt((text || '0').trim(), 10) || 0;
};

const navigationLabels: Record<'/' | '/quiz' | '/profile', RegExp> = {
    '/': /Главная|Home/i,
    '/quiz': /Практика|Practice|Quiz/i,
    '/profile': /Профиль|Profile/i,
};

const navigateWithinApp = async (page: Page, href: '/' | '/quiz' | '/profile') => {
    const navigationLink = page.getByRole('link', { name: navigationLabels[href] }).last();
    await navigationLink.click();
    await expect(page).toHaveURL(new RegExp(`${href === '/' ? '/$' : `${href.replace('/', '\\/')}(?:\\?.*)?$`}`), {
        timeout: 20_000,
    });
    await waitForAppReady(page);
};

const seedFavoritesViaApi = async (page: Page, minimumCount: number) => {
    const result = await page.evaluate(async ({ minimum }) => {
        const readAccessToken = () => {
            for (const key of Object.keys(window.localStorage)) {
                if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) {
                    continue;
                }

                const rawValue = window.localStorage.getItem(key);
                if (!rawValue) {
                    continue;
                }

                const parsedValue = JSON.parse(rawValue);
                if (parsedValue?.access_token) {
                    return parsedValue.access_token;
                }

                if (Array.isArray(parsedValue)) {
                    const tokenEntry = parsedValue.find((entry) => entry?.access_token);
                    if (tokenEntry?.access_token) {
                        return tokenEntry.access_token;
                    }
                }
            }

            return null;
        };

        const readTerms = () => {
            const rawTerms = window.localStorage.getItem('globalfinterm_terms');
            if (!rawTerms) {
                return [];
            }

            const today = new Date();
            today.setHours(23, 59, 59, 999);

            return JSON.parse(rawTerms)
                .filter((term) => new Date(term.next_review_date) <= today)
                .map((term) => term.id);
        };

        const accessToken = readAccessToken();
        if (!accessToken) {
            throw new Error('Missing Supabase access token for authenticated test.');
        }

        const candidateTermIds = readTerms().slice(0, minimum);
        if (candidateTermIds.length < minimum) {
            throw new Error(`Expected at least ${minimum} due-capable terms in local storage.`);
        }

        for (const termId of candidateTermIds) {
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    termId,
                    shouldFavorite: true,
                    idempotencyKey: crypto.randomUUID(),
                }),
            });

            if (!response.ok && response.status !== 409) {
                throw new Error(`Favorite seed failed for term ${termId} with status ${response.status}.`);
            }
        }

        const rawProgress = window.localStorage.getItem('globalfinterm_user_progress');
        const parsedProgress = rawProgress ? JSON.parse(rawProgress) : null;
        const nowIso = new Date().toISOString();
        const nextFavorites = Array.from(new Set([
            ...(Array.isArray(parsedProgress?.favorites) ? parsedProgress.favorites : []),
            ...candidateTermIds,
        ]));

        window.localStorage.setItem('globalfinterm_user_progress', JSON.stringify({
            user_id: typeof parsedProgress?.user_id === 'string' && parsedProgress.user_id.length > 0
                ? parsedProgress.user_id
                : 'authenticated_e2e_user',
            favorites: nextFavorites,
            current_language: ['tr', 'en', 'ru'].includes(parsedProgress?.current_language)
                ? parsedProgress.current_language
                : 'ru',
            quiz_history: Array.isArray(parsedProgress?.quiz_history) ? parsedProgress.quiz_history : [],
            total_words_learned: typeof parsedProgress?.total_words_learned === 'number'
                ? parsedProgress.total_words_learned
                : 0,
            current_streak: typeof parsedProgress?.current_streak === 'number'
                ? parsedProgress.current_streak
                : 0,
            last_study_date: typeof parsedProgress?.last_study_date === 'string' || parsedProgress?.last_study_date === null
                ? parsedProgress.last_study_date
                : null,
            created_at: typeof parsedProgress?.created_at === 'string' && parsedProgress.created_at.length > 0
                ? parsedProgress.created_at
                : nowIso,
            updated_at: nowIso,
        }));

        return candidateTermIds.length;
    }, { minimum: minimumCount });

    expect(result).toBeGreaterThanOrEqual(minimumCount);
};

const ensureMinimumDueCards = async (page: Page, minimumCount: number) => {
    await seedFavoritesViaApi(page, minimumCount);
    await navigateWithinApp(page, '/quiz');
    const dueCount = await readDueCount(page);

    expect(dueCount).toBeGreaterThanOrEqual(minimumCount);
    return dueCount;
};

test.describe('@auth-required Authenticated happy path', () => {
    test.skip(
        !process.env.E2E_AUTH_EMAIL || !process.env.E2E_AUTH_PASSWORD,
        'Authenticated E2E requires E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD.'
    );

    test('favorites a term, saves a profile edit, and persists quiz progress', async ({ authenticatedPage: page }) => {
        const dueBeforeQuiz = await ensureMinimumDueCards(page, 2);

        await navigateWithinApp(page, '/profile');
        await page.getByTestId('profile-edit-toggle').click();

        const nameInput = page.getByTestId('profile-name');
        await expect(nameInput).toBeVisible();

        const currentName = (await nameInput.inputValue()).trim();
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
