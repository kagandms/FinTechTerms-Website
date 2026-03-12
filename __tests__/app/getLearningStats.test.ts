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

describe('getLearningStats', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('uses the Supabase quiz_attempts count for totalReviews', async () => {
        const mockBadgesOrder = jest.fn().mockResolvedValue({
            data: [],
            error: null,
        });
        const mockBadgesEq = jest.fn(() => ({
            order: mockBadgesOrder,
        }));
        const mockBadgesSelect = jest.fn(() => ({
            eq: mockBadgesEq,
        }));
        const mockReviewEq = jest.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 27,
        });
        const mockReviewSelect = jest.fn(() => ({
            eq: mockReviewEq,
        }));
        const mockFrom = jest.fn((table: string) => {
            if (table === 'user_badges') {
                return {
                    select: mockBadgesSelect,
                };
            }

            if (table === 'quiz_attempts') {
                return {
                    select: mockReviewSelect,
                };
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

        expect(mockFrom).toHaveBeenCalledWith('user_badges');
        expect(mockFrom).toHaveBeenCalledWith('quiz_attempts');
        expect(mockReviewSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
        expect(mockReviewEq).toHaveBeenCalledWith('user_id', 'user-1');
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
            },
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
});
