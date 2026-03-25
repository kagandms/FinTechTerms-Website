/**
 * @jest-environment node
 */

const mockResolveAuthenticatedUser = jest.fn();
const mockCreateRequestScopedClient = jest.fn();
const mockLoadLearningStatsExportAttempts = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    resolveAuthenticatedUser: (...args: unknown[]) => mockResolveAuthenticatedUser(...args),
    createRequestScopedClient: (...args: unknown[]) => mockCreateRequestScopedClient(...args),
}));

jest.mock('@/lib/learning-stats', () => ({
    loadLearningStatsExportAttempts: (...args: unknown[]) => mockLoadLearningStatsExportAttempts(...args),
}));

describe('analytics export route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the authenticated user export payload', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
        mockCreateRequestScopedClient.mockResolvedValue({ supabase: true });
        mockLoadLearningStatsExportAttempts.mockResolvedValue([
            {
                id: 'attempt-1',
                termId: 'term-1',
                createdAt: '2026-03-20T10:00:00.000Z',
                isCorrect: true,
                responseTimeMs: 1200,
                quizType: 'daily',
            },
        ]);

        const { GET } = await import('@/app/api/analytics/export/route');
        const response = await GET(new Request('http://localhost:3000/api/analytics/export'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            exportedAt: expect.any(String),
            attempts: [
                {
                    id: 'attempt-1',
                    termId: 'term-1',
                    createdAt: '2026-03-20T10:00:00.000Z',
                    isCorrect: true,
                    responseTimeMs: 1200,
                    quizType: 'daily',
                },
            ],
        });
    });

    it('returns unauthorized when there is no authenticated user', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue(null);

        const { GET } = await import('@/app/api/analytics/export/route');
        const response = await GET(new Request('http://localhost:3000/api/analytics/export'));
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toMatchObject({
            code: 'UNAUTHORIZED',
            retryable: false,
        });
        expect(mockLoadLearningStatsExportAttempts).not.toHaveBeenCalled();
    });
});
