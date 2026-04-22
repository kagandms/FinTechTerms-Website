/**
 * @jest-environment node
 */

const mockGetSeoTermBySlug = jest.fn();

jest.mock('@/lib/public-seo-catalog', () => ({
    getSeoTermBySlug: (...args: unknown[]) => mockGetSeoTermBySlug(...args),
    getLocalizedTermSeoTitle: (term: { seo_title: { en: string; ru: string; tr: string } }, locale: 'en' | 'ru' | 'tr') => term.seo_title[locale],
    getLocalizedTermSeoDescription: (term: { seo_description: { en: string; ru: string; tr: string } }, locale: 'en' | 'ru' | 'tr') => term.seo_description[locale],
}));

describe('localized glossary metadata', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'test',
            NEXT_PUBLIC_SITE_URL: 'https://fintechterms.example.com',
        };
        mockGetSeoTermBySlug.mockResolvedValue({
            id: 'term_145',
            slug: 'tokenization',
            term_en: 'Tokenization',
            term_ru: 'Токенизация',
            term_tr: 'Tokenizasyon',
            seo_title: {
                en: 'Tokenization meaning in fintech and finance',
                ru: 'Токенизация: значение в финтехе и финансах',
                tr: 'Tokenizasyon nedir: fintek ve finans anlamı',
            },
            seo_description: {
                en: 'Learn Tokenization with definition, why it matters, how it works, risks, and BIST/MOEX/GLOBAL context.',
                ru: 'Изучите термин Токенизация: определение, значение, принцип работы, риски и контекст BIST/MOEX/GLOBAL.',
                tr: 'Tokenizasyon terimini tanım, önem, çalışma mantığı, riskler ve BIST/MOEX/GLOBAL bağlamıyla öğrenin.',
            },
        });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('builds locale-aware canonical and metadata for glossary term pages', async () => {
        const { generateMetadata } = await import('@/app/(public)/[locale]/glossary/[slug]/page');

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ru', slug: 'tokenization' }),
        });

        expect(metadata.title).toBe('Токенизация: значение в финтехе и финансах | FinTechTerms');
        expect(metadata.description).toBe('Изучите термин Токенизация: определение, значение, принцип работы, риски и контекст BIST/MOEX/GLOBAL.');
        expect(metadata.alternates?.canonical).toBe('https://fintechterms.example.com/ru/glossary/tokenization');
        expect(metadata.alternates?.languages).toEqual({
            ru: 'https://fintechterms.example.com/ru/glossary/tokenization',
            en: 'https://fintechterms.example.com/en/glossary/tokenization',
            tr: 'https://fintechterms.example.com/tr/glossary/tokenization',
        });
        expect(metadata.openGraph?.images).toEqual([
            {
                url: 'https://fintechterms.example.com/ru/glossary/tokenization/opengraph-image',
                width: 1200,
                height: 630,
                alt: 'Токенизация: значение в финтехе и финансах | FinTechTerms',
            },
        ]);
        expect(metadata.twitter?.images).toEqual([
            'https://fintechterms.example.com/ru/glossary/tokenization/opengraph-image',
        ]);
    });
});
