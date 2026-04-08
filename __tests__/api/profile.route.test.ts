/**
 * @jest-environment node
 */

export {};

const mockResolveAuthenticatedUser = jest.fn();
const mockCreateRequestScopedClient = jest.fn();
const mockProfileMutationCheck = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createRequestScopedClient: (request: Request) => mockCreateRequestScopedClient(request),
    resolveAuthenticatedUser: (request: Request) => mockResolveAuthenticatedUser(request),
}));

jest.mock('@/lib/rate-limiter', () => ({
    profileMutationRateLimiter: {
        check: (...args: unknown[]) => mockProfileMutationCheck(...args),
    },
    isRateLimiterUnavailable: (result: { unavailable?: boolean }) => result.unavailable === true,
}));

const createRequest = (body: Record<string, unknown>) => new Request('http://localhost:3000/api/profile', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
});

describe('profile route', () => {
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-04-05T12:00:00.000Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockProfileMutationCheck.mockResolvedValue({
            allowed: true,
            remaining: 9,
            retryAfter: 0,
            unavailable: false,
        });
    });

    it('returns 401 when the caller is unauthenticated', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue(null);

        const { POST } = await import('@/app/api/profile/route');
        const response = await POST(createRequest({
            fullName: 'Alex Stone',
            birthDate: '2000-01-01',
        }));
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toMatchObject({
            code: 'UNAUTHORIZED',
            retryable: false,
        });
    });

    it('returns ok when both canonical profile and metadata sync succeed', async () => {
        const upsert = jest.fn().mockResolvedValue({ error: null });
        const from = jest.fn(() => ({ upsert }));
        const updateUser = jest.fn().mockResolvedValue({ error: null });

        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'alex@example.com',
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            from,
            auth: {
                updateUser,
            },
        });

        const { POST } = await import('@/app/api/profile/route');
        const response = await POST(createRequest({
            fullName: 'Alex Stone',
            birthDate: '2000-01-01',
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            status: 'ok',
            message: 'Successfully saved',
        });
        expect(upsert).toHaveBeenCalledWith({
            id: 'user-1',
            full_name: 'Alex Stone',
            birth_date: '2000-01-01',
        }, {
            onConflict: 'id',
        });
        expect(updateUser).toHaveBeenCalledWith({
            data: {
                name: 'Alex Stone',
                full_name: 'Alex Stone',
                birth_date: '2000-01-01',
            },
        });
    });

    it('returns partial_metadata_sync when auth metadata update fails', async () => {
        const upsert = jest.fn().mockResolvedValue({ error: null });
        const from = jest.fn(() => ({ upsert }));
        const updateUser = jest.fn().mockResolvedValue({
            error: {
                message: 'metadata sync failed',
            },
        });

        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'alex@example.com',
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            from,
            auth: {
                updateUser,
            },
        });

        const { POST } = await import('@/app/api/profile/route');
        const response = await POST(createRequest({
            fullName: 'Alex Stone',
            birthDate: null,
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            status: 'partial_metadata_sync',
            message: 'Profile details were saved, but the secondary auth sync did not complete.',
        });
    });

    it('returns 429 when the profile mutation rate limit is exceeded', async () => {
        mockProfileMutationCheck.mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            retryAfter: 120,
            unavailable: false,
        });
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'alex@example.com',
        });

        const { POST } = await import('@/app/api/profile/route');
        const response = await POST(createRequest({
            fullName: 'Alex Stone',
            birthDate: '2000-01-01',
        }));
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body).toMatchObject({
            code: 'RATE_LIMITED',
            retryable: true,
        });
        expect(mockCreateRequestScopedClient).not.toHaveBeenCalled();
    });

    it.each([
        '2026-04-06',
        '2014-04-06',
        '1905-04-04',
        '2026-02-31',
    ])('rejects invalid or out-of-policy birth dates (%s)', async (birthDate) => {
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'alex@example.com',
        });

        const { POST } = await import('@/app/api/profile/route');
        const response = await POST(createRequest({
            fullName: 'Alex Stone',
            birthDate,
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'VALIDATION_ERROR',
            retryable: false,
        });
        expect(mockCreateRequestScopedClient).not.toHaveBeenCalled();
    });
});
