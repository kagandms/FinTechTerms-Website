/**
 * @jest-environment node
 */

const mockGetPublicTermById = jest.fn();

jest.mock('@/lib/public-term-catalog', () => ({
    getPublicTermById: (...args: unknown[]) => mockGetPublicTermById(...args),
}));

jest.mock('@/components/SmartCard', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('@/components/TermTaxonomy', () => ({
    TaxonomySummary: () => null,
}));

describe('term page metadata', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'test',
            NEXT_PUBLIC_SITE_URL: 'https://fintechterms.example.com',
        };
        mockGetPublicTermById.mockResolvedValue({
            id: 'term_123',
            term_ru: 'Облигация',
            term_en: 'Bond',
            term_tr: 'Tahvil',
            definition_ru: 'Описание термина',
            definition_en: 'Definition of the term',
            definition_tr: 'Terim aciklamasi',
            category: 'Finance',
            regional_market: 'MOEX',
            context_tags: {},
            created_at: '2026-03-11T00:00:00.000Z',
        });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('uses the dynamic opengraph image route instead of a missing static asset', async () => {
        const { generateMetadata } = await import('@/app/term/[id]/page');

        const metadata = await generateMetadata({
            params: Promise.resolve({ id: 'term_123' }),
        });

        expect(metadata.openGraph?.images).toEqual([
            expect.objectContaining({
                url: 'https://fintechterms.example.com/term/term_123/opengraph-image',
            }),
        ]);
        expect(metadata.twitter?.images).toEqual([
            'https://fintechterms.example.com/term/term_123/opengraph-image',
        ]);
    });
});
