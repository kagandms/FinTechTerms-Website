/**
 * @jest-environment node
 */

export {};

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();
const mockReadTrackedStudySessionContext = jest.fn();

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

jest.mock('@/lib/study-session-storage', () => ({
    readTrackedStudySessionContext: () => mockReadTrackedStudySessionContext(),
}));

const validQuizResponseBody = {
    state: {
        userProgress: {
            current_streak: 1,
            last_study_date: '2026-03-11T00:00:00.000Z',
            total_words_learned: 0,
            updated_at: '2026-03-11T00:00:00.000Z',
        },
        termSrs: {
            term_id: 'term-1',
            srs_level: 2,
            next_review_date: '2026-03-12T00:00:00.000Z',
            last_reviewed: '2026-03-11T00:00:00.000Z',
            difficulty_score: 2.4,
            retention_rate: 0.5,
            times_reviewed: 1,
            times_correct: 1,
        },
    },
};

describe('supabaseStorage response validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockReadTrackedStudySessionContext.mockReturnValue(null);
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

    it('prefers explicit replay session context and forwards occurred_at to the API route', async () => {
        mockReadTrackedStudySessionContext.mockReturnValue({
            sessionId: 'fallback-session',
            sessionToken: 'f'.repeat(32),
        });
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(validQuizResponseBody),
        }) as typeof fetch;

        const { saveQuizAttemptToSupabase } = await import('@/lib/supabaseStorage');

        await expect(saveQuizAttemptToSupabase('user-1', {
            id: 'attempt-1',
            term_id: 'term-1',
            is_correct: true,
            response_time_ms: 1200,
            timestamp: '2026-03-11T09:30:00.000Z',
            quiz_type: 'review',
            sessionId: 'replayed-session',
            sessionToken: 'r'.repeat(32),
        })).resolves.toMatchObject({
            status: 'ok',
        });

        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        expect(fetchCall).toBeDefined();
        const requestBody = JSON.parse(fetchCall?.[1]?.body as string);

        expect(requestBody).toMatchObject({
            occurred_at: '2026-03-11T09:30:00.000Z',
            quiz_type: 'review',
            session_id: 'replayed-session',
            session_token: 'r'.repeat(32),
        });
        expect(requestBody.session_id).not.toBe('fallback-session');
    });

    afterEach(() => {
        jest.useRealTimers();
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

    it('classifies favorite limit 409 responses as limit_reached', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 409,
            json: jest.fn().mockResolvedValue({
                code: 'FAVORITES_LIMIT_REACHED',
                message: 'Favorite limit reached. Complete your member setup to save more terms.',
                retryable: false,
            }),
        }) as typeof fetch;

        const { toggleFavoriteInSupabase } = await import('@/lib/supabaseStorage');

        await expect(toggleFavoriteInSupabase('user-1', 'term-1', true)).resolves.toEqual({
            status: 'limit_reached',
            message: 'Favorite limit reached. Complete your member setup to save more terms.',
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

    it('fails fast when the authenticated progress reads exceed the browser timeout budget', async () => {
        const never = new Promise<never>(() => {});
        const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout').mockImplementation((((callback: TimerHandler) => {
            if (typeof callback === 'function') {
                callback();
            }

            return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
        }) as unknown) as typeof globalThis.setTimeout);
        const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout').mockImplementation((((() => undefined) as unknown)) as typeof globalThis.clearTimeout);

        mockFrom.mockImplementation((table: string) => {
            if (table === 'user_progress' || table === 'user_settings') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            maybeSingle: jest.fn(() => never),
                        })),
                    })),
                };
            }

            if (table === 'user_favorites') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn(() => never),
                        })),
                    })),
                };
            }

            if (table === 'quiz_attempts') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn(() => ({
                                limit: jest.fn(() => never),
                            })),
                        })),
                    })),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        mockRpc.mockReturnValue(never);

        const { getUserProgressFromSupabase } = await import('@/lib/supabaseStorage');
        try {
            await expect(getUserProgressFromSupabase('user-1')).rejects.toThrow('Loading is taking too long — please try again');
        } finally {
            setTimeoutSpy.mockRestore();
            clearTimeoutSpy.mockRestore();
        }
    }, 10000);
});
