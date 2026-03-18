/**
 * @jest-environment node
 */

const mockGetUser = jest.fn();

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(() => ({
        auth: {
            getUser: mockGetUser,
        },
    })),
}));

describe('proxy locale headers', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        };
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('sets Content-Language from the persisted language cookie', async () => {
        const { NextRequest } = await import('next/server');
        const { proxy } = await import('@/proxy');

        const request = new NextRequest('https://fintechterms.app/search', {
            headers: {
                cookie: 'ftt-language=tr',
            },
        });

        const response = await proxy(request);

        expect(response.headers.get('Content-Language')).toBe('tr');
        expect(response.headers.get('Vary')).toContain('Cookie');
    });

    it('falls back to Accept-Language when the cookie is absent', async () => {
        const { NextRequest } = await import('next/server');
        const { proxy } = await import('@/proxy');

        const request = new NextRequest('https://fintechterms.app/search', {
            headers: {
                'accept-language': 'en-US,en;q=0.9,tr;q=0.8',
            },
        });

        const response = await proxy(request);

        expect(response.headers.get('Content-Language')).toBe('en');
        expect(response.headers.get('Vary')).toContain('Accept-Language');
    });

    it('resolves Russian requests when Accept-Language prefers ru', async () => {
        const { NextRequest } = await import('next/server');
        const { proxy } = await import('@/proxy');

        const request = new NextRequest('https://fintechterms.app/search', {
            headers: {
                'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8',
            },
        });

        const response = await proxy(request);

        expect(response.headers.get('Content-Language')).toBe('ru');
    });

    it('redirects legacy about requests permanently using the persisted locale', async () => {
        const { NextRequest } = await import('next/server');
        const { proxy } = await import('@/proxy');

        const request = new NextRequest('https://fintechterms.app/about', {
            headers: {
                cookie: 'ftt-language=tr',
            },
        });

        const response = await proxy(request);

        expect(response.status).toBe(308);
        expect(response.headers.get('location')).toBe('https://fintechterms.app/tr/about');
        expect(response.headers.get('Content-Language')).toBe('tr');
    });

    it('redirects legacy methodology requests permanently using Accept-Language fallback', async () => {
        const { NextRequest } = await import('next/server');
        const { proxy } = await import('@/proxy');

        const request = new NextRequest('https://fintechterms.app/methodology', {
            headers: {
                'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
            },
        });

        const response = await proxy(request);

        expect(response.status).toBe(308);
        expect(response.headers.get('location')).toBe('https://fintechterms.app/en/methodology');
        expect(response.headers.get('Content-Language')).toBe('en');
    });

    it('redirects legacy term requests permanently and lets lang override cookie and headers', async () => {
        const { NextRequest } = await import('next/server');
        const { proxy } = await import('@/proxy');

        const request = new NextRequest('https://fintechterms.app/term/term_145?lang=en', {
            headers: {
                cookie: 'ftt-language=ru',
                'accept-language': 'tr-TR,tr;q=0.9,en;q=0.8',
            },
        });

        const response = await proxy(request);

        expect(response.status).toBe(308);
        expect(response.headers.get('location')).toBe('https://fintechterms.app/en/glossary/tokenization');
        expect(response.headers.get('Content-Language')).toBe('en');
    });
});
