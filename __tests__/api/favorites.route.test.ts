/**
 * @jest-environment node
 */

import { apiRouteRateLimiter, favoritesMutationRateLimiter } from '@/lib/rate-limiter';

export {};

const mockResolveAuthenticatedUser = jest.fn();
const mockCreateRequestScopedClient = jest.fn();
const mockInspectIdempotentRequest = jest.fn();
const mockReserveIdempotentRequest = jest.fn();
const mockCompleteIdempotentRequest = jest.fn();
const mockDeleteIdempotentRequest = jest.fn();
const mockFailIdempotentRequest = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createRequestScopedClient: (request: Request) => mockCreateRequestScopedClient(request),
    resolveAuthenticatedUser: (request: Request) => mockResolveAuthenticatedUser(request),
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
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
        });

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

        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
        });
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
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
        });

        const rpc = jest.fn().mockResolvedValue({
            data: {
                success: true,
                isFavorite: true,
                termId: 'term-1',
                favorites: ['term-1'],
            },
            error: null,
        });
        mockCreateRequestScopedClient.mockResolvedValue({ rpc });

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
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
        });
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

    it('does not pass a user id through the favorite mutation RPC payload', async () => {
        const rpc = jest.fn().mockResolvedValue({
            data: {
                success: true,
                isFavorite: true,
                termId: 'term-1',
                favorites: ['term-1'],
            },
            error: null,
        });
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
        });
        mockCreateRequestScopedClient.mockResolvedValue({ rpc });

        const { POST } = await import('@/app/api/favorites/route');
        const response = await POST(createPostRequest({
            termId: 'term-1',
            shouldFavorite: true,
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        }));

        expect(response.status).toBe(200);
        expect(rpc).toHaveBeenCalledWith(
            'toggle_my_favorite',
            expect.not.objectContaining({ p_user_id: expect.anything() })
        );
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
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
        });
        mockCreateRequestScopedClient.mockResolvedValue({ rpc });
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
});
