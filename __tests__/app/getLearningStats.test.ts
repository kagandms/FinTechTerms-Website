/**
 * @jest-environment node
 */

const mockCreateOptionalClient = jest.fn();
const mockSafeGetSupabaseUser = jest.fn();
const mockCreateApiError = jest.fn((code: string, message: string, status: number) => ({
    error: { code, message, status },
}));

jest.mock('@/utils/supabase/server', () => ({
    createOptionalClient: () => mockCreateOptionalClient(),
}));

jest.mock('@/lib/auth/session', () => ({
    AUTH_REQUIRED_MESSAGE: 'Authentication required',
    safeGetSupabaseUser: (client: unknown) => mockSafeGetSupabaseUser(client),
}));

jest.mock('@/lib/supabaseUtils', () => ({
    createApiError: (code: string, message: string, status: number) => mockCreateApiError(code, message, status),
}));

const createRecentAttemptsChain = (data: unknown[] = [], error: { message: string } | null = null) => {
    const limit = jest.fn().mockResolvedValue({
        data,
        error,
    });
    const secondaryOrder = jest.fn(() => ({
        limit,
    }));
    const primaryOrder = jest.fn(() => ({
        order: secondaryOrder,
    }));
    const eq = jest.fn(() => ({
        order: primaryOrder,
    }));

    return {
        select: jest.fn(() => ({
            eq,
        })),
        eq,
        primaryOrder,
        secondaryOrder,
        limit,
    };
};

describe('getLearningStats', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns exact metrics, average response time, and recent attempts', async () => {
        const badgesOrder = jest.fn().mockResolvedValue({
            data: [],
            error: null,
        });
        const badgesEq = jest.fn(() => ({
            order: badgesOrder,
        }));
        const badgesSelect = jest.fn(() => ({
            eq: badgesEq,
        }));
        const recentAttemptsChain = createRecentAttemptsChain([
            {
                id: 'attempt-1',
                term_id: 'term-1',
                created_at: '2026-03-11T10:00:00.000Z',
                is_correct: true,
                response_time_ms: 1200,
                quiz_type: 'daily',
            },
        ]);
        const mockFrom = jest.fn((table: string) => {
            if (table === 'user_badges') {
                return {
                    select: badgesSelect,
                };
            }

            if (table === 'quiz_attempts') {
                return recentAttemptsChain;
            }

            throw new Error(`Unexpected table ${table}`);
        });
        const mockRpc = jest.fn()
            .mockResolvedValueOnce({
                data: [
                    { log_date: '2026-03-10', activity_count: 3 },
                    { log_date: '2026-03-11', activity_count: 1 },
                ],
                error: null,
            })
            .mockResolvedValueOnce({
                data: [{ current_streak: 4, last_study_date: '2026-03-11' }],
                error: null,
            })
            .mockResolvedValueOnce({
                data: [{ total_reviews: 27, correct_reviews: 19, avg_response_time_ms: 1475 }],
                error: null,
            });

        mockCreateOptionalClient.mockResolvedValue({
            rpc: mockRpc,
            from: mockFrom,
        });
        mockSafeGetSupabaseUser.mockResolvedValue({
            user: { id: 'user-1' },
            ghostSession: false,
            message: null,
        });

        const { getLearningStats } = await import('@/app/actions/getLearningStats');
        const result = await getLearningStats();

        expect(mockRpc).toHaveBeenNthCalledWith(1, 'get_user_learning_heatmap');
        expect(mockRpc).toHaveBeenNthCalledWith(2, 'get_user_streak_summary', {
            p_user_id: 'user-1',
        });
        expect(mockRpc).toHaveBeenNthCalledWith(3, 'get_user_quiz_metrics', {
            p_user_id: 'user-1',
        });
        expect(mockFrom).toHaveBeenCalledWith('user_badges');
        expect(mockFrom).toHaveBeenCalledWith('quiz_attempts');
        expect(result).toEqual({
            ok: true,
            data: {
                heatmap: [
                    { log_date: '2026-03-10', activity_count: 3 },
                    { log_date: '2026-03-11', activity_count: 1 },
                ],
                currentStreak: 4,
                lastStudyDate: '2026-03-11',
                badges: [],
                activeDays: 2,
                totalActivity: 4,
                todayActivity: 1,
                totalReviews: 27,
                correctReviews: 19,
                accuracy: 70,
                avgResponseTimeMs: 1475,
                recentAttempts: [
                    {
                        id: 'attempt-1',
                        termId: 'term-1',
                        createdAt: '2026-03-11T10:00:00.000Z',
                        isCorrect: true,
                        responseTimeMs: 1200,
                        quizType: 'daily',
                    },
                ],
            },
            degraded: false,
            missing: [],
        });
    });

    it('returns partial analytics when the exact quiz metrics RPC fails', async () => {
        const badgesOrder = jest.fn().mockResolvedValue({
            data: [],
            error: null,
        });
        const badgesEq = jest.fn(() => ({
            order: badgesOrder,
        }));
        const badgesSelect = jest.fn(() => ({
            eq: badgesEq,
        }));
        const recentAttemptsChain = createRecentAttemptsChain();
        const mockFrom = jest.fn((table: string) => {
            if (table === 'user_badges') {
                return {
                    select: badgesSelect,
                };
            }

            if (table === 'quiz_attempts') {
                return recentAttemptsChain;
            }

            throw new Error(`Unexpected table ${table}`);
        });
        const mockRpc = jest.fn()
            .mockResolvedValueOnce({
                data: [{ log_date: '2026-03-11', activity_count: 1 }],
                error: null,
            })
            .mockResolvedValueOnce({
                data: [{ current_streak: 1, last_study_date: '2026-03-11' }],
                error: null,
            })
            .mockResolvedValueOnce({
                data: null,
                error: { message: 'metrics failed' },
            });

        mockCreateOptionalClient.mockResolvedValue({
            rpc: mockRpc,
            from: mockFrom,
        });
        mockSafeGetSupabaseUser.mockResolvedValue({
            user: { id: 'user-1' },
            ghostSession: false,
            message: null,
        });

        const { getLearningStats } = await import('@/app/actions/getLearningStats');
        const result = await getLearningStats();

        expect(result).toEqual({
            ok: true,
            data: {
                heatmap: [{ log_date: '2026-03-11', activity_count: 1 }],
                currentStreak: 1,
                lastStudyDate: '2026-03-11',
                badges: [],
                activeDays: 1,
                totalActivity: 1,
                todayActivity: 1,
                totalReviews: null,
                correctReviews: null,
                accuracy: null,
                avgResponseTimeMs: null,
                recentAttempts: [],
            },
            degraded: true,
            missing: ['metrics'],
        });
    });

    it('returns unauthorized without logging when the server client is unavailable', async () => {
        mockCreateOptionalClient.mockResolvedValue(null);

        const { getLearningStats } = await import('@/app/actions/getLearningStats');
        const result = await getLearningStats();

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                status: 401,
            },
        });
        expect(mockSafeGetSupabaseUser).not.toHaveBeenCalled();
    });

    it('returns a 500 payload only when every analytics segment fails', async () => {
        const mockFrom = jest.fn((table: string) => {
            if (table === 'user_badges') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn().mockResolvedValue({
                                data: null,
                                error: { message: 'badges failed' },
                            }),
                        })),
                    })),
                };
            }

            if (table === 'quiz_attempts') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn(() => ({
                                order: jest.fn(() => ({
                                    limit: jest.fn().mockResolvedValue({
                                        data: null,
                                        error: { message: 'recent attempts failed' },
                                    }),
                                })),
                            })),
                        })),
                    })),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });
        const mockRpc = jest.fn()
            .mockResolvedValueOnce({
                data: null,
                error: { message: 'heatmap failed' },
            })
            .mockResolvedValueOnce({
                data: null,
                error: { message: 'streak failed' },
            })
            .mockResolvedValueOnce({
                data: null,
                error: { message: 'metrics failed' },
            });

        mockCreateOptionalClient.mockResolvedValue({
            rpc: mockRpc,
            from: mockFrom,
        });
        mockSafeGetSupabaseUser.mockResolvedValue({
            user: { id: 'user-1' },
            ghostSession: false,
            message: null,
        });

        const { getLearningStats } = await import('@/app/actions/getLearningStats');
        const result = await getLearningStats();

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'LEARNING_STATS_UNAVAILABLE',
                message: 'Unable to load learning stats.',
                status: 500,
            },
        });
    });
});
