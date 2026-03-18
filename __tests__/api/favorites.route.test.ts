/**
 * @jest-environment node
 */

export {};

const mockResolveAuthenticatedUser = jest.fn();
const mockCreateRequestScopedClient = jest.fn();
const mockCreateServiceRoleClient = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createRequestScopedClient: (request: Request) => mockCreateRequestScopedClient(request),
    createServiceRoleClient: () => mockCreateServiceRoleClient(),
    resolveAuthenticatedUser: (request: Request) => mockResolveAuthenticatedUser(request),
}));

const createRequest = () => new Request('http://localhost:3000/api/favorites', {
    method: 'GET',
});

describe('favorites route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
});
