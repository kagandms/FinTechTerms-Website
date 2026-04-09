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

describe('progress route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 503 when every progress segment fails instead of returning a 200 error payload', async () => {
        const queryError = { message: 'segment failed' };
        const rejected = Promise.reject(new Error('streak rpc failed'));
        void rejected.catch(() => undefined);
        const from = jest.fn((table: string) => {
            if (table === 'user_progress' || table === 'user_settings') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: queryError }),
                        })),
                    })),
                };
            }

            if (table === 'user_favorites') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn().mockResolvedValue({ data: null, error: queryError }),
                        })),
                    })),
                };
            }

            return {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        order: jest.fn(() => ({
                            limit: jest.fn().mockResolvedValue({ data: null, error: queryError }),
                        })),
                    })),
                })),
            };
        });

        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            from,
            rpc: jest.fn(() => rejected),
        });

        const { GET } = await import('@/app/api/progress/route');
        const response = await GET(new Request('http://localhost:3000/api/progress'));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            code: 'PROGRESS_LOAD_FAILED',
            message: 'Unable to load study progress from Supabase.',
            retryable: true,
        });
    });
});
