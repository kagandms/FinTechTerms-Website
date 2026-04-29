/**
 * @jest-environment node
 */

import { MAX_FAVORITES_RESPONSE_ITEMS } from '@/lib/favorite-limits';

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
                            order: jest.fn(() => ({
                                limit: jest.fn().mockResolvedValue({ data: null, error: queryError }),
                            })),
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

    it('returns 413 when favorites exceed the bounded progress response size', async () => {
        const from = jest.fn((table: string) => {
            if (table === 'user_progress') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            maybeSingle: jest.fn().mockResolvedValue({
                                data: {
                                    total_words_learned: 0,
                                    created_at: '2026-03-20T10:00:00.000Z',
                                    updated_at: '2026-03-20T10:00:00.000Z',
                                },
                                error: null,
                            }),
                        })),
                    })),
                };
            }

            if (table === 'user_favorites') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn(() => ({
                                limit: jest.fn().mockResolvedValue({
                                    data: Array.from(
                                        { length: MAX_FAVORITES_RESPONSE_ITEMS + 1 },
                                        (_, index) => ({ term_id: `term-${index}` })
                                    ),
                                    error: null,
                                }),
                            })),
                        })),
                    })),
                };
            }

            if (table === 'quiz_attempts') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn(() => ({
                                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                            })),
                        })),
                    })),
                };
            }

            return {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                    })),
                })),
            };
        });

        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
        });
        mockCreateRequestScopedClient.mockResolvedValue({
            from,
            rpc: jest.fn().mockResolvedValue({
                data: [{ current_streak: 0, last_study_date: null }],
                error: null,
            }),
        });

        const { GET } = await import('@/app/api/progress/route');
        const response = await GET(new Request('http://localhost:3000/api/progress'));
        const body = await response.json();

        expect(response.status).toBe(413);
        expect(body).toMatchObject({
            code: 'FAVORITES_RESPONSE_TOO_LARGE',
            retryable: false,
        });
    });
});
