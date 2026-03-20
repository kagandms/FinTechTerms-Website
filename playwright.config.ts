import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const shouldUseExternalBaseUrl = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
        },
    ],
    webServer: shouldUseExternalBaseUrl
        ? undefined
        : {
            command: 'NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:-http://127.0.0.1:3000} HOSTNAME=127.0.0.1 npm run build && NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:-http://127.0.0.1:3000} HOSTNAME=127.0.0.1 npm run start',
            url: 'http://127.0.0.1:3000',
            reuseExistingServer: !process.env.CI,
            timeout: 180 * 1000,
        },
});
