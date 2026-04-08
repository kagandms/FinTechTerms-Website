/**
 * @jest-environment node
 */

export {};

const mockResolveAuthenticatedUser = jest.fn();
const mockCreateRequestScopedClient = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    createRequestScopedClient: (request: Request) => mockCreateRequestScopedClient(request),
    resolveAuthenticatedUser: (request: Request) => mockResolveAuthenticatedUser(request),
}));

describe('progress SRS route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
});
