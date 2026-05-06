/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const publicLocaleLayoutPath = path.join(process.cwd(), 'app/(public)/[locale]/layout.tsx');
const rootLayoutPath = path.join(process.cwd(), 'app/(root)/layout.tsx');
const rootPagePath = path.join(process.cwd(), 'app/(root)/page.tsx');
const homeClientPath = path.join(process.cwd(), 'app/HomeClient.tsx');
const searchClientPath = path.join(process.cwd(), 'app/search/SearchClient.tsx');
const rootErrorPath = path.join(process.cwd(), 'app/error.tsx');
const globalErrorPath = path.join(process.cwd(), 'app/global-error.tsx');
const instrumentationClientPath = path.join(process.cwd(), 'instrumentation-client.ts');

describe('public SEO metadata and route assets', () => {
    const originalEnv = process.env;
    const normalizeLastModified = (value: string | Date | undefined): string | null => (
        value ? new Date(value).toISOString() : null
    );

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'test',
            NEXT_PUBLIC_SITE_URL: 'https://fintechterms.example.com',
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('keeps root layout canonical and x-default alternates', async () => {
        const routeModule = await import('@/app/(root)/layout');

        expect(routeModule.metadata.alternates?.canonical).toBe('https://fintechterms.example.com');
        expect(routeModule.metadata.alternates?.languages).toEqual({
            'x-default': 'https://fintechterms.example.com',
            ru: 'https://fintechterms.example.com/ru',
            en: 'https://fintechterms.example.com/en',
            tr: 'https://fintechterms.example.com/tr',
        });
        expect(routeModule.metadata.openGraph?.url).toBe('https://fintechterms.example.com');
    });

    it('builds localized topic metadata with canonical and hreflang alternates', async () => {
        const { generateMetadata } = await import('@/app/(public)/[locale]/topics/[topicSlug]/page');

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en', topicSlug: 'cards-payments' }),
        });

        expect(metadata.alternates?.canonical).toBe('https://fintechterms.example.com/en/topics/cards-payments');
        expect(metadata.alternates?.languages).toEqual({
            'x-default': 'https://fintechterms.example.com/ru/topics/cards-payments',
            ru: 'https://fintechterms.example.com/ru/topics/cards-payments',
            en: 'https://fintechterms.example.com/en/topics/cards-payments',
            tr: 'https://fintechterms.example.com/tr/topics/cards-payments',
        });
        expect(metadata.title).toBe('Cards and payments infrastructure | FinTechTerms');
    });

    it('builds localized author metadata with canonical and hreflang alternates', async () => {
        const { generateMetadata } = await import('@/app/(public)/[locale]/authors/[authorSlug]/page');

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en', authorSlug: 'kagan-samet-durmus' }),
        });

        expect(metadata.alternates?.canonical).toBe('https://fintechterms.example.com/en/authors/kagan-samet-durmus');
        expect(metadata.alternates?.languages).toEqual({
            'x-default': 'https://fintechterms.example.com/ru/authors/kagan-samet-durmus',
            ru: 'https://fintechterms.example.com/ru/authors/kagan-samet-durmus',
            en: 'https://fintechterms.example.com/en/authors/kagan-samet-durmus',
            tr: 'https://fintechterms.example.com/tr/authors/kagan-samet-durmus',
        });
        expect(metadata.title).toBe('Kağan Samet Durmuş editorial profile | FinTechTerms');
        expect(metadata.description).toContain('Editorial profile and reviewed glossary coverage');
    });

    it('keeps public SEO locale layout free of app-shell state providers', () => {
        const source = fs.readFileSync(publicLocaleLayoutPath, 'utf8');

        expect(source).not.toContain('AuthProvider');
        expect(source).not.toContain('SRSProvider');
        expect(source).not.toContain('BottomNav');
        expect(source).not.toContain('SessionTracker');
        expect(source).not.toContain('BadgeRealtimeNotifier');
        expect(source).not.toContain('PublicLocalePreferenceSync');
        expect(source).not.toContain('jetbrainsMono');
        expect(source).toContain('PublicAnalyticsConsent');
        expect(source).toContain('GoogleAnalytics');
    });

    it('keeps global error boundaries free of app state and catalog imports', () => {
        const sources = [
            fs.readFileSync(rootErrorPath, 'utf8'),
            fs.readFileSync(globalErrorPath, 'utf8'),
        ];

        for (const source of sources) {
            expect(source).not.toContain("@/utils/storage");
            expect(source).not.toContain("@/contexts/LanguageContext");
            expect(source).not.toContain("@/lib/logger");
            expect(source).not.toContain("@/data/terms");
            expect(source).not.toContain("next/navigation");
        }
    });

    it('keeps root app shell imports behind dynamic boundaries', () => {
        const rootLayoutSource = fs.readFileSync(rootLayoutPath, 'utf8');
        const rootPageSource = fs.readFileSync(rootPagePath, 'utf8');

        expect(rootLayoutSource).not.toContain("@/contexts/AuthContext");
        expect(rootLayoutSource).not.toContain("@/contexts/SRSContext");
        expect(rootLayoutSource).not.toContain("@/components/SessionTracker");
        expect(rootLayoutSource).not.toContain("@/components/root-app-shell");
        expect(rootPageSource).not.toContain("nextDynamic");
        expect(rootPageSource).not.toContain("@/app/HomeClient");
        expect(rootPageSource).toContain("Public SEO entry points");
    });

    it('keeps client Sentry instrumentation off the initial SEO render path', () => {
        const source = fs.readFileSync(instrumentationClientPath, 'utf8');

        expect(source).not.toContain("import * as Sentry");
        expect(source).not.toContain("captureRouterTransitionStart");
        expect(source).toContain("import('@sentry/nextjs')");
        expect(source).toContain("window.addEventListener('load'");
        expect(source).toContain("export const onRouterTransitionStart = (): void => {}");
    });

    it('keeps SearchAction schema off noindex app-shell search surfaces', () => {
        const sources = [
            fs.readFileSync(homeClientPath, 'utf8'),
            fs.readFileSync(searchClientPath, 'utf8'),
        ];

        for (const source of sources) {
            expect(source).not.toContain('SearchAction');
            expect(source).not.toContain('search_term_string');
        }
    });

    it('keeps robots rules and sitemap location stable', async () => {
        const { default: robots } = await import('@/app/robots');

        expect(robots()).toEqual({
            rules: {
                userAgent: '*',
                allow: '/',
                disallow: ['/admin', '/api/', '/dashboard', '/favorites', '/profile', '/quiz', '/search', '/term/'],
            },
            sitemap: 'https://fintechterms.example.com/sitemap.xml',
        });
    });

    it('keeps sitemap coverage for root, static locale pages, topics, authors, and glossary terms', async () => {
        const { default: sitemap } = await import('@/app/sitemap');

        const entries = await sitemap();
        const urls = new Set(entries.map((entry) => entry.url));

        expect(urls.has('https://fintechterms.example.com')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/ru/about')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/en/privacy')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/en/terms')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/en/contact')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/en/topics/cards-payments')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/en/topics/cards-payments/terms')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/tr/authors/kagan-samet-durmus')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/en/glossary/tokenization')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/en/glossary/market-index')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/en/glossary/index')).toBe(false);
    });

    it('adds multilingual alternates to sitemap entries', async () => {
        const { default: sitemap } = await import('@/app/sitemap');

        const entries = await sitemap();
        const termEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/en/glossary/tokenization');

        expect(termEntry?.alternates?.languages).toEqual({
            'x-default': 'https://fintechterms.example.com/ru/glossary/tokenization',
            ru: 'https://fintechterms.example.com/ru/glossary/tokenization',
            en: 'https://fintechterms.example.com/en/glossary/tokenization',
            tr: 'https://fintechterms.example.com/tr/glossary/tokenization',
        });
    });

    it('uses the root URL as x-default for locale home entries', async () => {
        const { default: sitemap } = await import('@/app/sitemap');

        const entries = await sitemap();
        const localeHomeEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/en');

        expect(localeHomeEntry?.alternates?.languages).toEqual({
            'x-default': 'https://fintechterms.example.com',
            ru: 'https://fintechterms.example.com/ru',
            en: 'https://fintechterms.example.com/en',
            tr: 'https://fintechterms.example.com/tr',
        });
    });

    it('uses stable content-backed freshness for sitemap entries', async () => {
        const { default: sitemap } = await import('@/app/sitemap');

        const entries = await sitemap();
        const rootEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com');
        const aboutEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/ru/about');
        const topicEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/en/topics/cards-payments');
        const authorEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/tr/authors/kagan-samet-durmus');
        const contactEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/en/contact');
        const termEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/en/glossary/tokenization');

        expect(normalizeLastModified(rootEntry?.lastModified)).toBe('2026-03-15T00:00:00.000Z');
        expect(normalizeLastModified(aboutEntry?.lastModified)).toBe('2026-03-15T00:00:00.000Z');
        expect(normalizeLastModified(topicEntry?.lastModified)).toBe('2026-03-15T00:00:00.000Z');
        expect(normalizeLastModified(authorEntry?.lastModified)).toBe('2026-03-15T00:00:00.000Z');
        expect(normalizeLastModified(contactEntry?.lastModified)).toBe('2026-05-04T00:00:00.000Z');
        expect(normalizeLastModified(termEntry?.lastModified)).toBe('2026-05-04T00:00:00.000Z');
    });

    it('uses locale-scoped 1200x630 Open Graph images for non-term public pages', async () => {
        const { generateMetadata } = await import('@/app/(public)/[locale]/about/page');

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en' }),
        });
        const images = (
            metadata.openGraph?.images as Array<{ url: string; width: number; height: number }> | undefined
        ) ?? [];
        const [image] = images;

        expect(image).toEqual({
            url: 'https://fintechterms.example.com/en/opengraph-image-o1kegr',
            width: 1200,
            height: 630,
            alt: 'About FinTechTerms | FinTechTerms',
        });
        expect((metadata.twitter as { card?: string } | undefined)?.card).toBe('summary_large_image');
    });

    it('does not generate freshness churn for non-term sitemap entries across calls', async () => {
        const { default: sitemap } = await import('@/app/sitemap');

        const firstEntries = await sitemap();
        const secondEntries = await sitemap();
        const firstAboutEntry = firstEntries.find((entry) => entry.url === 'https://fintechterms.example.com/ru/about');
        const secondAboutEntry = secondEntries.find((entry) => entry.url === 'https://fintechterms.example.com/ru/about');

        expect(normalizeLastModified(firstAboutEntry?.lastModified)).toBe(
            normalizeLastModified(secondAboutEntry?.lastModified)
        );
    });
});
