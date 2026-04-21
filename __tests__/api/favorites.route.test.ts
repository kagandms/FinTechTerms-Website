/**
 * @jest-environment node
 */

import { apiRouteRateLimiter, favoritesMutationRateLimiter } from '@/lib/rate-limiter';

export {};

const mockResolveAuthenticatedUser = jest.fn();
const mockCreateRequestScopedClient = jest.fn();
const mockResolveRequestMemberEntitlements = jest.fn();
const mockInspectIdempotentRequest = jest.fn();
const mockReserveIdempotentRequest = jest.fn();
const mockCompleteIdempotentRequest = jest.fn();
const mockDeleteIdempotentRequest = jest.fn();
const mockFailIdempotentRequest = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createRequestScopedClient: (request: Request) => mockCreateRequestScopedClient(request),
    resolveAuthenticatedUser: (request: Request) => mockResolveAuthenticatedUser(request),
}));

jest.mock('@/lib/server-member-entitlements', () => ({
    resolveRequestMemberEntitlements: (...args: unknown[]) => mockResolveRequestMemberEntitlements(...args),
}));

jest.mock('@/lib/api-idempotency', () => ({
    inspectIdempotentRequest: (...args: unknown[]) => mockInspectIdempotentRequest(...args),
    reserveIdempotentRequest: (...args: unknown[]) => mockReserveIdempotentRequest(...args),
    completeIdempotentRequest: (...args: unknown[]) => mockCompleteIdempotentRequest(...args),
    deleteIdempotentRequest: (...args: unknown[]) => mockDeleteIdempotentRequest(...args),
    failIdempotentRequest: (...args: unknown[]) => mockFailIdempotentRequest(...args),
}));

const createRequest = () => new Request('http://localhost:3000/api/favorites', {
    method: 'GET',
});

const createPostRequest = (body: Record<string, unknown>) => new Request('http://localhost:3000/api/favorites', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.10',
    },
    body: JSON.stringify(body),
});

describe('favorites route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        apiRouteRateLimiter.reset();
        favoritesMutationRateLimiter.reset();
        mockResolveRequestMemberEntitlements.mockResolvedValue({
            user: {
                id: 'user-1',
                email: 'user@example.com',
            },
            entitlements: {
                maxFavorites: Number.POSITIVE_INFINITY,
            },
            unavailable: null,
        });
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            rpc: jest.fn(),
            from: jest.fn(),
        });
        mockInspectIdempotentRequest.mockResolvedValue({ kind: 'proceed' });
        mockReserveIdempotentRequest.mockResolvedValue({ kind: 'proceed' });
        mockCompleteIdempotentRequest.mockResolvedValue(undefined);
        mockDeleteIdempotentRequest.mockResolvedValue(undefined);
        mockFailIdempotentRequest.mockResolvedValue(undefined);
    });

    it('loads favorites through a request-scoped authenticated client', async () => {
        const order = jest.fn().mockResolvedValue({
            data: [{ term_id: 'term-1' }, { term_id: 'term-2' }],
            error: null,
        });
        const eq = jest.fn(() => ({ order }));
        const select = jest.fn(() => ({ eq }));
        const from = jest.fn(() => ({ select }));

        mockCreateRequestScopedClient.mockResolvedValue({ from });

        const { GET } = await import('@/app/api/favorites/route');
        const response = await GET(createRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            favorites: ['term-1', 'term-2'],
        });
        expect(mockCreateRequestScopedClient).toHaveBeenCalledTimes(1);
    });

    it('replays cached POST responses before touching route or write rate limiters', async () => {
        const routeLimitSpy = jest.spyOn(apiRouteRateLimiter, 'check');
        const writeLimitSpy = jest.spyOn(favoritesMutationRateLimiter, 'check');
        mockInspectIdempotentRequest.mockResolvedValue({
            kind: 'replay',
            statusCode: 200,
            responseBody: {
                success: true,
                isFavorite: true,
                termId: 'term-1',
                favorites: ['term-1'],
            },
        });

        const { POST } = await import('@/app/api/favorites/route');
        const response = await POST(createPostRequest({
            termId: 'term-1',
            shouldFavorite: true,
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            isFavorite: true,
            termId: 'term-1',
            favorites: ['term-1'],
        });
        expect(routeLimitSpy).not.toHaveBeenCalled();
        expect(writeLimitSpy).not.toHaveBeenCalled();
        expect(mockReserveIdempotentRequest).not.toHaveBeenCalled();

        routeLimitSpy.mockRestore();
        writeLimitSpy.mockRestore();
    });

    it('uses the authoritative favorite mutation RPC for successful writes', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: {
                success: true,
                isFavorite: true,
                termId: 'term-1',
                favorites: ['term-1'],
            },
            error: null,
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            rpc,
            from: jest.fn(),
        });

        const { POST } = await import('@/app/api/favorites/route');
        const response = await POST(createPostRequest({
            termId: 'term-1',
            shouldFavorite: true,
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            isFavorite: true,
            termId: 'term-1',
            favorites: ['term-1'],
        });
        expect(mockCreateRequestScopedClient).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith('toggle_my_favorite', {
            p_term_id: 'term-1',
            p_should_favorite: true,
        });
        expect(mockCompleteIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            action: 'favorite_mutation',
            userId: 'user-1',
            statusCode: 200,
            responseBody: body,
        }));
    });

    it('returns 503 when the route rate limiter is unavailable', async () => {
        jest.spyOn(apiRouteRateLimiter, 'check').mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            retryAfter: 60,
            unavailable: true,
        });

        const { POST } = await import('@/app/api/favorites/route');
        const response = await POST(createPostRequest({
            termId: 'term-1',
            shouldFavorite: true,
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'RATE_LIMITER_UNAVAILABLE',
            retryable: true,
        });
        expect(mockReserveIdempotentRequest).not.toHaveBeenCalled();
    });

    it('passes the resolved user id into the trusted server favorite wrapper payload', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: {
                success: true,
                isFavorite: true,
                termId: 'term-1',
                favorites: ['term-1'],
            },
            error: null,
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            rpc,
            from: jest.fn(),
        });

        const { POST } = await import('@/app/api/favorites/route');
        const response = await POST(createPostRequest({
            termId: 'term-1',
            shouldFavorite: true,
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));

        expect(response.status).toBe(200);
        expect(rpc).toHaveBeenCalledWith('toggle_my_favorite', {
            p_term_id: 'term-1',
            p_should_favorite: true,
        });
    });

    it('still returns 200 when idempotency completion fails after the favorite write succeeds', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: {
                success: true,
                isFavorite: true,
                termId: 'term-1',
                favorites: ['term-1'],
            },
            error: null,
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            rpc,
            from: jest.fn(),
        });
        mockCompleteIdempotentRequest.mockRejectedValueOnce(new Error('idempotency completion failed'));

        const { POST } = await import('@/app/api/favorites/route');
        const response = await POST(createPostRequest({
            termId: 'term-1',
            shouldFavorite: true,
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            isFavorite: true,
            termId: 'term-1',
            favorites: ['term-1'],
        });
        expect(mockDeleteIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            action: 'favorite_mutation',
            userId: 'user-1',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));
        expect(mockFailIdempotentRequest).not.toHaveBeenCalled();
    });

    it('returns 409 when the server-side favorite limit is exhausted', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: null,
            error: {
                code: '23514',
                message: 'Favorite limit reached.',
            },
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            rpc,
            from: jest.fn(),
        });

        const { POST } = await import('@/app/api/favorites/route');
        const response = await POST(createPostRequest({
            termId: 'term-2',
            shouldFavorite: true,
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body).toMatchObject({
            code: 'FAVORITES_LIMIT_REACHED',
            retryable: false,
        });
        expect(rpc).toHaveBeenCalledWith('toggle_my_favorite', {
            p_term_id: 'term-2',
            p_should_favorite: true,
        });
        expect(mockFailIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            action: 'favorite_mutation',
            statusCode: 409,
            responseBody: expect.objectContaining({
                code: 'FAVORITES_LIMIT_REACHED',
            }),
        }));
    });

    it('returns 503 when the request-scoped client is unavailable during write handling', async () => {
        mockCreateRequestScopedClient.mockResolvedValueOnce(null);

        const { POST } = await import('@/app/api/favorites/route');
        const response = await POST(createPostRequest({
            termId: 'term-1',
            shouldFavorite: true,
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'FAVORITES_UPDATE_FAILED',
            retryable: true,
        });
    });

    it('returns 404 when the trusted server favorite wrapper reports a missing term', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: null,
            error: {
                code: 'P0002',
                message: 'Term not found.',
            },
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            rpc,
            from: jest.fn(),
        });

        const { POST } = await import('@/app/api/favorites/route');
        const response = await POST(createPostRequest({
            termId: 'term-1',
            shouldFavorite: true,
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toMatchObject({
            code: 'TERM_NOT_FOUND',
            retryable: false,
        });
        expect(mockFailIdempotentRequest).toHaveBeenCalledWith(expect.objectContaining({
            action: 'favorite_mutation',
            statusCode: 404,
        }));
    });
});
