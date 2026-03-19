/**
 * @jest-environment node
 */

import { apiRouteRateLimiter, favoritesMutationRateLimiter } from '@/lib/rate-limiter';

export {};

const mockResolveAuthenticatedUser = jest.fn();
const mockCreateRequestScopedClient = jest.fn();
const mockCreateServiceRoleClient = jest.fn();
const mockInspectIdempotentRequest = jest.fn();
const mockReserveIdempotentRequest = jest.fn();
const mockCompleteIdempotentRequest = jest.fn();
const mockFailIdempotentRequest = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createRequestScopedClient: (request: Request) => mockCreateRequestScopedClient(request),
    createServiceRoleClient: () => mockCreateServiceRoleClient(),
    resolveAuthenticatedUser: (request: Request) => mockResolveAuthenticatedUser(request),
}));

jest.mock('@/lib/api-idempotency', () => ({
    inspectIdempotentRequest: (...args: unknown[]) => mockInspectIdempotentRequest(...args),
    reserveIdempotentRequest: (...args: unknown[]) => mockReserveIdempotentRequest(...args),
    completeIdempotentRequest: (...args: unknown[]) => mockCompleteIdempotentRequest(...args),
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
        mockInspectIdempotentRequest.mockResolvedValue({ kind: 'proceed' });
        mockReserveIdempotentRequest.mockResolvedValue({ kind: 'proceed' });
        mockCompleteIdempotentRequest.mockResolvedValue(undefined);
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
        expect(mockCreateServiceRoleClient).not.toHaveBeenCalled();
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
});
