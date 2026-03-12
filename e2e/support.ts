import type { Page } from '@playwright/test';

type PreviewBypassPage = Page & {
    __previewBypassInstalled?: boolean;
};

export const applyPreviewProtectionBypass = async (page: Page): Promise<void> => {
    const previewPage = page as PreviewBypassPage;

    if (previewPage.__previewBypassInstalled) {
        return;
    }

    const automationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL;

    if (!automationBypassSecret || !baseUrl) {
        previewPage.__previewBypassInstalled = true;
        return;
    }

    const baseOrigin = new URL(baseUrl).origin;

    await page.route('**/*', async (route) => {
        const request = route.request();

        if (!request.url().startsWith(baseOrigin)) {
            await route.continue();
            return;
        }

        await route.continue({
            headers: {
                ...request.headers(),
                'x-vercel-protection-bypass': automationBypassSecret,
                'x-vercel-set-bypass-cookie': 'true',
            },
        });
    });

    previewPage.__previewBypassInstalled = true;
};

export const grantResearchConsent = async (page: Page): Promise<void> => {
    await page.addInitScript(() => {
        window.localStorage.setItem('fintechterms_research_consent', JSON.stringify({
            given: true,
            timestamp: '2026-03-11T00:00:00.000Z',
            version: '1.0',
        }));
    });
};

export const waitForAppReady = async (page: Page): Promise<void> => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
};
