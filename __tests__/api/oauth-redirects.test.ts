/**
 * @jest-environment node
 */

export {};

const mockCreateAuthRouteClient = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const originalVercelUrl = process.env.VERCEL_URL;

jest.mock('@/lib/public-env', () => ({
    getPublicEnv: () => ({
        siteUrl: 'https://fintechterms.example',
    }),
}));

jest.mock('@/lib/auth/route-handler', () => ({
    createAuthRouteClient: () => mockCreateAuthRouteClient(),
    createAuthUnavailableResponse: () => Response.json({
        code: 'AUTH_UNAVAILABLE',
    }, { status: 503 }),
}));

describe('OAuth redirect hardening', () => {
    beforeEach(() => {
        delete process.env.VERCEL_URL;
        jest.clearAllMocks();
        mockCreateAuthRouteClient.mockReturnValue({
            supabase: {
                auth: {
                    signInWithOAuth: mockSignInWithOAuth,
                    exchangeCodeForSession: mockExchangeCodeForSession,
                },
            },
            applyCookies: (response: Response) => response,
        });
        mockSignInWithOAuth.mockResolvedValue({
            data: { url: 'https://accounts.google.example/oauth' },
            error: null,
        });
        mockExchangeCodeForSession.mockResolvedValue({ error: null });
    });

    afterEach(() => {
        if (originalVercelUrl) {
            process.env.VERCEL_URL = originalVercelUrl;
            return;
        }

        delete process.env.VERCEL_URL;
    });

    it('rejects protocol-relative redirectTo values before sending the Supabase OAuth redirect', async () => {
        const { GET } = await import('@/app/api/auth/oauth/google/route');

        const response = await GET(new Request(
            'https://fintechterms.example/api/auth/oauth/google?redirectTo=%2F%2Fattacker.example%2Fsteal'
        ));

        expect(response.headers.get('location')).toBe('https://accounts.google.example/oauth');
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
            provider: 'google',
            options: {
                redirectTo: 'https://fintechterms.example/api/auth/callback?next=%2Fprofile%3Fcomplete%3D1',
            },
        });
    });

    it('reduces allowed absolute same-site redirectTo values to internal paths', async () => {
        process.env.VERCEL_URL = 'preview.fintechterms.example';
        const { GET } = await import('@/app/api/auth/oauth/google/route');

        await GET(new Request(
            'https://preview.fintechterms.example/api/auth/oauth/google?redirectTo=https%3A%2F%2Ffintechterms.example%2Ffavorites%3Ffrom%3Dlogin',
            {
                headers: {
                    'x-forwarded-host': 'preview.fintechterms.example',
                },
            }
        ));

        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
            provider: 'google',
            options: {
                redirectTo: 'https://preview.fintechterms.example/api/auth/callback?next=%2Ffavorites%3Ffrom%3Dlogin',
            },
        });
    });

    it('does not trust unconfigured forwarded hosts when building callback origins', async () => {
        const { GET } = await import('@/app/api/auth/oauth/google/route');

        await GET(new Request(
            'https://internal.vercel.example/api/auth/oauth/google?redirectTo=%2Ffavorites',
            {
                headers: {
                    'x-forwarded-host': 'attacker.example',
                },
            }
        ));

        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
            provider: 'google',
            options: {
                redirectTo: 'https://fintechterms.example/api/auth/callback?next=%2Ffavorites',
            },
        });
    });

    it('rejects protocol-relative callback next values after code exchange', async () => {
        const { GET } = await import('@/app/api/auth/callback/route');

        const response = await GET(new Request(
            'https://fintechterms.example/api/auth/callback?code=abc&next=%2F%2Fattacker.example%2Fsteal'
        ));

        expect(response.headers.get('location')).toBe('https://fintechterms.example/profile?complete=1');
    });

    it('handles provider callback failures without exchanging an OAuth code', async () => {
        const { GET } = await import('@/app/api/auth/callback/route');

        const response = await GET(new Request(
            'https://fintechterms.example/api/auth/callback?error=access_denied&error_description=User%20cancelled'
        ));

        expect(response.headers.get('location')).toBe('https://fintechterms.example/profile?authError=GENERIC');
        expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    });
});
