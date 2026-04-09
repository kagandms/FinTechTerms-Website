/**
 * @jest-environment node
 */

export {};

const mockResolveAuthenticatedUser = jest.fn();
const mockCreateRequestScopedClient = jest.fn();
const mockSrsProgressCheck = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createRequestScopedClient: (request: Request) => mockCreateRequestScopedClient(request),
    resolveAuthenticatedUser: (request: Request) => mockResolveAuthenticatedUser(request),
}));

jest.mock('@/lib/rate-limiter', () => ({
    srsProgressRouteRateLimiter: {
        check: (...args: unknown[]) => mockSrsProgressCheck(...args),
        reset: jest.fn(),
    },
    isRateLimiterUnavailable: (result: { unavailable?: boolean }) => result.unavailable === true,
}));

jest.mock('@/lib/admin-access', () => ({
    isAdminUserId: (userId: string | null | undefined) => userId === 'admin-user',
}));

describe('progress SRS route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSrsProgressCheck.mockResolvedValue({
            allowed: true,
            remaining: 29,
            retryAfter: 0,
            unavailable: false,
        });
    });

    it('returns 400 for malformed JSON without touching auth or database clients', async () => {
        const { POST } = await import('@/app/api/progress/srs/route');
        const response = await POST(new Request('http://localhost:3000/api/progress/srs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: '{',
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'INVALID_JSON',
            message: 'SRS progress request body must be valid JSON.',
            retryable: false,
        });
        expect(mockResolveAuthenticatedUser).not.toHaveBeenCalled();
        expect(mockCreateRequestScopedClient).not.toHaveBeenCalled();
    });

    it('rejects unbounded diagnostics for non-admin users', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'member-user',
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            from: jest.fn(),
        });

        const { POST } = await import('@/app/api/progress/srs/route');
        const response = await POST(new Request('http://localhost:3000/api/progress/srs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                unbounded: true,
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            code: 'FORBIDDEN',
            message: 'Unbounded SRS diagnostics require admin access.',
            retryable: false,
        });
    });

    it('returns 503 when the SRS query fails instead of masking the failure behind a 200 status', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'member-user',
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            from: jest.fn(() => ({
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        in: jest.fn().mockResolvedValue({
                            data: null,
                            error: {
                                message: 'srs query failed',
                            },
                        }),
                    })),
                })),
            })),
        });

        const { POST } = await import('@/app/api/progress/srs/route');
        const response = await POST(new Request('http://localhost:3000/api/progress/srs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                termIds: ['term-1'],
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'SRS_PROGRESS_UNAVAILABLE',
            message: 'Unable to load SRS progress.',
            retryable: true,
        });
    });
});
