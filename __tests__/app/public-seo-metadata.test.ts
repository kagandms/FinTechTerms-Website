/**
 * @jest-environment node
 */

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

        expect(routeModule.metadata.alternates?.canonical).toBe('/');
        expect(routeModule.metadata.alternates?.languages).toEqual({
            'x-default': '/',
            ru: '/ru',
            en: '/en',
            tr: '/tr',
        });
        expect(routeModule.metadata.openGraph?.url).toBe('https://fintechterms.example.com');
    });

    it('builds localized topic metadata with canonical and hreflang alternates', async () => {
        const { generateMetadata } = await import('@/app/(public)/[locale]/topics/[topicSlug]/page');

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en', topicSlug: 'cards-payments' }),
        });

        expect(metadata.alternates?.canonical).toBe('/en/topics/cards-payments');
        expect(metadata.alternates?.languages).toEqual({
            ru: '/ru/topics/cards-payments',
            en: '/en/topics/cards-payments',
            tr: '/tr/topics/cards-payments',
        });
        expect(metadata.title).toBe('Cards and payments infrastructure | FinTechTerms');
    });

    it('builds localized author metadata with canonical and hreflang alternates', async () => {
        const { generateMetadata } = await import('@/app/(public)/[locale]/authors/[authorSlug]/page');

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en', authorSlug: 'kagan-samet-durmus' }),
        });

        expect(metadata.alternates?.canonical).toBe('/en/authors/kagan-samet-durmus');
        expect(metadata.alternates?.languages).toEqual({
            ru: '/ru/authors/kagan-samet-durmus',
            en: '/en/authors/kagan-samet-durmus',
            tr: '/tr/authors/kagan-samet-durmus',
        });
        expect(metadata.title).toBe('Kağan Samet Durmuş | FinTechTerms');
    });

    it('keeps robots rules and sitemap location stable', async () => {
        const { default: robots } = await import('@/app/robots');

        expect(robots()).toEqual({
            rules: {
                userAgent: '*',
                allow: '/',
                disallow: ['/admin', '/api/'],
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
        expect(urls.has('https://fintechterms.example.com/en/topics/cards-payments')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/tr/authors/kagan-samet-durmus')).toBe(true);
        expect(urls.has('https://fintechterms.example.com/en/glossary/tokenization')).toBe(true);
    });

    it('uses stable content-backed freshness for non-term sitemap entries', async () => {
        const { default: sitemap } = await import('@/app/sitemap');

        const entries = await sitemap();
        const rootEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com');
        const aboutEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/ru/about');
        const topicEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/en/topics/cards-payments');
        const authorEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/tr/authors/kagan-samet-durmus');
        const termEntry = entries.find((entry) => entry.url === 'https://fintechterms.example.com/en/glossary/tokenization');

        expect(normalizeLastModified(rootEntry?.lastModified)).toBe('2026-03-15T00:00:00.000Z');
        expect(normalizeLastModified(aboutEntry?.lastModified)).toBe('2026-03-15T00:00:00.000Z');
        expect(normalizeLastModified(topicEntry?.lastModified)).toBe('2026-03-15T00:00:00.000Z');
        expect(normalizeLastModified(authorEntry?.lastModified)).toBe('2026-03-15T00:00:00.000Z');
        expect(normalizeLastModified(termEntry?.lastModified)).toBe('2026-03-15T00:00:00.000Z');
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
