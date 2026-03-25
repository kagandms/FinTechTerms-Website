/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
    getSupabaseClient: () => ({
        from: (...args: unknown[]) => mockFrom(...args),
        rpc: (...args: unknown[]) => mockRpc(...args),
        auth: {
            getSession: (...args: unknown[]) => mockGetSession(...args),
            refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
        },
    }),
}));

describe('supabaseStorage response validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSession.mockResolvedValue({
            data: {
                session: {
                    access_token: 'token',
                },
            },
        });
        mockRefreshSession.mockResolvedValue({ data: {}, error: null });
    });

    it('returns a retryable result for malformed 200 OK quiz responses', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                state: {
                    userProgress: {
                        current_streak: 4,
                    },
                },
            }),
        }) as typeof fetch;

        const { saveQuizAttemptToSupabase } = await import('@/lib/supabaseStorage');

        await expect(saveQuizAttemptToSupabase('user-1', {
            id: 'attempt-1',
            term_id: 'term-1',
            is_correct: true,
            response_time_ms: 1200,
            timestamp: '2026-03-11T00:00:00.000Z',
            quiz_type: 'daily',
        })).resolves.toEqual({
            status: 'retryable',
            message: 'Quiz service returned malformed data.',
        });
    });

    it('classifies final 401 quiz responses as auth_expired', async () => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: jest.fn().mockResolvedValue({ message: 'Unauthorized' }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: jest.fn().mockResolvedValue({ message: 'Unauthorized' }),
            }) as typeof fetch;

        const { saveQuizAttemptToSupabase } = await import('@/lib/supabaseStorage');

        await expect(saveQuizAttemptToSupabase('user-1', {
            id: 'attempt-1',
            term_id: 'term-1',
            is_correct: true,
            response_time_ms: 1200,
            timestamp: '2026-03-11T00:00:00.000Z',
            quiz_type: 'daily',
        })).resolves.toEqual({
            status: 'auth_expired',
            message: 'Session expired. Please sign in again to save this answer.',
        });
    });

    it('classifies final 401 favorite responses as auth_expired', async () => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: jest.fn().mockResolvedValue({ message: 'Unauthorized' }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: jest.fn().mockResolvedValue({ message: 'Unauthorized' }),
            }) as typeof fetch;

        const { toggleFavoriteInSupabase } = await import('@/lib/supabaseStorage');

        await expect(toggleFavoriteInSupabase('user-1', 'term-1', true)).resolves.toEqual({
            status: 'auth_expired',
            message: 'Session expired. Please sign in again to update favorites.',
        });
    });

    it('classifies 422 quiz responses as non_retryable', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 422,
            json: jest.fn().mockResolvedValue({ message: 'Validation failed.' }),
        }) as typeof fetch;

        const { saveQuizAttemptToSupabase } = await import('@/lib/supabaseStorage');

        await expect(saveQuizAttemptToSupabase('user-1', {
            id: 'attempt-1',
            term_id: 'term-1',
            is_correct: true,
            response_time_ms: 1200,
            timestamp: '2026-03-11T00:00:00.000Z',
            quiz_type: 'daily',
        })).resolves.toEqual({
            status: 'non_retryable',
            message: 'Validation failed.',
        });
    });

    it('classifies retryable 409 quiz responses as retryable', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 409,
            json: jest.fn().mockResolvedValue({
                message: 'An identical request is already being processed.',
                retryable: true,
            }),
        }) as typeof fetch;

        const { saveQuizAttemptToSupabase } = await import('@/lib/supabaseStorage');

        await expect(saveQuizAttemptToSupabase('user-1', {
            id: 'attempt-1',
            term_id: 'term-1',
            is_correct: true,
            response_time_ms: 1200,
            timestamp: '2026-03-11T00:00:00.000Z',
            quiz_type: 'daily',
        })).resolves.toEqual({
            status: 'retryable',
            message: 'An identical request is already being processed.',
        });
    });

    it('classifies retryable 409 favorite responses as retryable', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 409,
            json: jest.fn().mockResolvedValue({
                message: 'An identical request is already being processed.',
                retryable: true,
            }),
        }) as typeof fetch;

        const { toggleFavoriteInSupabase } = await import('@/lib/supabaseStorage');

        await expect(toggleFavoriteInSupabase('user-1', 'term-1', true)).resolves.toEqual({
            status: 'retryable',
            message: 'An identical request is already being processed.',
        });
    });

    it('returns a partial progress result when only the canonical progress row is malformed', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: {
                total_words_learned: 'not-a-number',
            },
            error: null,
        });
        const favoritesOrder = jest.fn().mockResolvedValue({
            data: [],
            error: null,
        });
        const quizLimit = jest.fn().mockResolvedValue({
            data: [],
            error: null,
        });
        const quizOrder = jest.fn(() => ({
            limit: quizLimit,
        }));

        mockFrom.mockImplementation((table: string) => {
            if (table === 'user_progress') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            maybeSingle,
                        })),
                    })),
                };
            }

            if (table === 'user_favorites' || table === 'quiz_attempts') {
                const orderHandler = table === 'user_favorites' ? favoritesOrder : quizOrder;

                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: orderHandler,
                        })),
                    })),
                };
            }

            if (table === 'user_settings') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            maybeSingle: jest.fn().mockResolvedValue({
                                data: null,
                                error: null,
                            }),
                        })),
                    })),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        mockRpc.mockResolvedValue({
            data: [],
            error: null,
        });

        const { getUserProgressFromSupabase } = await import('@/lib/supabaseStorage');
        await expect(getUserProgressFromSupabase('user-1')).resolves.toMatchObject({
            status: 'partial',
            missing: ['user_progress'],
            message: 'Study progress loaded with gaps: progress summary.',
            data: {
                user_id: 'user-1',
                favorites: [],
                quiz_history: [],
                total_words_learned: 0,
            },
        });
    });
});
