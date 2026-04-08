/**
 * @jest-environment node
 */

export {};

const mockReadTrackedStudySessionContext = jest.fn();

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

const createJsonResponse = (
    payload: unknown,
    init?: {
        ok?: boolean;
        status?: number;
    }
) => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: jest.fn().mockResolvedValue(payload),
}) as unknown as Response;

const createAbortError = (): Error => {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
};

describe('supabaseStorage response validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockReadTrackedStudySessionContext.mockReturnValue(null);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns a retryable result for malformed 200 OK quiz responses', async () => {
        global.fetch = jest.fn().mockResolvedValue(createJsonResponse({
            state: {
                userProgress: {
                    current_streak: 4,
                },
            },
        })) as typeof fetch;

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
        global.fetch = jest.fn().mockResolvedValue(
            createJsonResponse(validQuizResponseBody)
        ) as typeof fetch;

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
        const requestBody = JSON.parse(fetchCall?.[1]?.body as string);

        expect(requestBody).toMatchObject({
            occurred_at: '2026-03-11T09:30:00.000Z',
            quiz_type: 'review',
            session_id: 'replayed-session',
            session_token: 'r'.repeat(32),
        });
        expect(fetchCall?.[1]).toMatchObject({
            credentials: 'same-origin',
            method: 'POST',
        });
        expect(requestBody.session_id).not.toBe('fallback-session');
    });

    it('classifies final 401 quiz responses as auth_expired', async () => {
        global.fetch = jest.fn().mockResolvedValue(
            createJsonResponse(
                { message: 'Unauthorized' },
                {
                    ok: false,
                    status: 401,
                }
            )
        ) as typeof fetch;

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
        global.fetch = jest.fn().mockResolvedValue(
            createJsonResponse(
                { message: 'Unauthorized' },
                {
                    ok: false,
                    status: 401,
                }
            )
        ) as typeof fetch;

        const { toggleFavoriteInSupabase } = await import('@/lib/supabaseStorage');

        await expect(toggleFavoriteInSupabase('user-1', 'term-1', true)).resolves.toEqual({
            status: 'auth_expired',
            message: 'Session expired. Please sign in again to update favorites.',
        });
    });

    it('classifies 422 quiz responses as non_retryable', async () => {
        global.fetch = jest.fn().mockResolvedValue(
            createJsonResponse(
                { message: 'Validation failed.' },
                {
                    ok: false,
                    status: 422,
                }
            )
        ) as typeof fetch;

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
        global.fetch = jest.fn().mockResolvedValue(
            createJsonResponse(
                {
                    message: 'An identical request is already being processed.',
                    retryable: true,
                },
                {
                    ok: false,
                    status: 409,
                }
            )
        ) as typeof fetch;

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
        global.fetch = jest.fn().mockResolvedValue(
            createJsonResponse(
                {
                    message: 'An identical request is already being processed.',
                    retryable: true,
                },
                {
                    ok: false,
                    status: 409,
                }
            )
        ) as typeof fetch;

        const { toggleFavoriteInSupabase } = await import('@/lib/supabaseStorage');

        await expect(toggleFavoriteInSupabase('user-1', 'term-1', true)).resolves.toEqual({
            status: 'retryable',
            message: 'An identical request is already being processed.',
        });
    });

    it('classifies favorite limit 409 responses as limit_reached', async () => {
        global.fetch = jest.fn().mockResolvedValue(
            createJsonResponse(
                {
                    code: 'FAVORITES_LIMIT_REACHED',
                    message: 'Favorite limit reached. Complete your member setup to save more terms.',
                    retryable: false,
                },
                {
                    ok: false,
                    status: 409,
                }
            )
        ) as typeof fetch;

        const { toggleFavoriteInSupabase } = await import('@/lib/supabaseStorage');

        await expect(toggleFavoriteInSupabase('user-1', 'term-1', true)).resolves.toEqual({
            status: 'limit_reached',
            message: 'Favorite limit reached. Complete your member setup to save more terms.',
        });
    });

    it('returns the route partial result when progress loads with gaps', async () => {
        global.fetch = jest.fn().mockResolvedValue(createJsonResponse({
            status: 'partial',
            missing: ['user_progress'],
            message: 'Study progress loaded with gaps: progress summary.',
            data: {
                user_id: 'user-1',
                favorites: [],
                current_language: 'ru',
                quiz_history: [],
                total_words_learned: 0,
                current_streak: 0,
                last_study_date: null,
                created_at: '2026-03-11T00:00:00.000Z',
                updated_at: '2026-03-11T00:00:00.000Z',
            },
        })) as typeof fetch;

        const { getUserProgressFromSupabase } = await import('@/lib/supabaseStorage');

        await expect(getUserProgressFromSupabase('user-1')).resolves.toEqual({
            status: 'partial',
            missing: ['user_progress'],
            message: 'Study progress loaded with gaps: progress summary.',
            data: {
                user_id: 'user-1',
                favorites: [],
                current_language: 'ru',
                quiz_history: [],
                total_words_learned: 0,
                current_streak: 0,
                last_study_date: null,
                created_at: '2026-03-11T00:00:00.000Z',
                updated_at: '2026-03-11T00:00:00.000Z',
            },
        });
    });

    it('fails fast when the authenticated progress route exceeds the browser timeout budget', async () => {
        const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout').mockImplementation((((callback: TimerHandler) => {
            if (typeof callback === 'function') {
                callback();
            }

            return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
        }) as unknown) as typeof globalThis.setTimeout);
        const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout').mockImplementation((((() => undefined) as unknown)) as typeof globalThis.clearTimeout);

        global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal as AbortSignal | undefined;

            if (signal?.aborted) {
                reject(createAbortError());
                return;
            }

            signal?.addEventListener('abort', () => {
                reject(createAbortError());
            });
        })) as typeof fetch;

        const { getUserProgressFromSupabase } = await import('@/lib/supabaseStorage');

        try {
            await expect(getUserProgressFromSupabase('user-1')).rejects.toThrow('Loading is taking too long — please try again');
        } finally {
            setTimeoutSpy.mockRestore();
            clearTimeoutSpy.mockRestore();
        }
    }, 10000);
});
