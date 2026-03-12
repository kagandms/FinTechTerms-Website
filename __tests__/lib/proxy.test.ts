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
});
