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
    InvalidAnalyticsExportCursorError: class InvalidAnalyticsExportCursorError extends Error {
        constructor(message = 'Analytics export cursor is invalid.') {
            super(message);
            this.name = 'InvalidAnalyticsExportCursorError';
        }
    },
    loadLearningStatsExportAttempts: (...args: unknown[]) => mockLoadLearningStatsExportAttempts(...args),
}));

describe('analytics export route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the authenticated user export payload', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
        mockCreateRequestScopedClient.mockResolvedValue({ supabase: true });
        mockLoadLearningStatsExportAttempts.mockResolvedValue({
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
            nextCursor: 'opaque-cursor',
        });

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
            nextCursor: 'opaque-cursor',
        });
    });

    it('forwards cursor and limit parameters to the export loader', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
        mockCreateRequestScopedClient.mockResolvedValue({ supabase: true });
        mockLoadLearningStatsExportAttempts.mockResolvedValue({
            attempts: [],
            nextCursor: null,
        });

        const { GET } = await import('@/app/api/analytics/export/route');
        const response = await GET(new Request('http://localhost:3000/api/analytics/export?cursor=opaque-cursor&limit=250'));

        expect(response.status).toBe(200);
        expect(mockLoadLearningStatsExportAttempts).toHaveBeenCalledWith(
            { supabase: true },
            'user-1',
            {
                cursor: 'opaque-cursor',
                limit: 250,
            }
        );
    });

    it('returns 400 when the export cursor is invalid', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
        mockCreateRequestScopedClient.mockResolvedValue({ supabase: true });
        const { InvalidAnalyticsExportCursorError } = await import('@/lib/learning-stats');
        mockLoadLearningStatsExportAttempts.mockRejectedValue(new InvalidAnalyticsExportCursorError());

        const { GET } = await import('@/app/api/analytics/export/route');
        const response = await GET(new Request('http://localhost:3000/api/analytics/export?cursor=bad-cursor'));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            code: 'INVALID_CURSOR',
            retryable: false,
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

    it('streams a downloadable export without client-side pagination accumulation', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
        mockCreateRequestScopedClient.mockResolvedValue({ supabase: true });
        mockLoadLearningStatsExportAttempts
            .mockResolvedValueOnce({
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
                nextCursor: 'cursor-2',
            })
            .mockResolvedValueOnce({
                attempts: [
                    {
                        id: 'attempt-2',
                        termId: 'term-2',
                        createdAt: '2026-03-20T11:00:00.000Z',
                        isCorrect: false,
                        responseTimeMs: 900,
                        quizType: 'review',
                    },
                ],
                nextCursor: null,
            });

        const { GET } = await import('@/app/api/analytics/export/route');
        const response = await GET(new Request('http://localhost:3000/api/analytics/export?download=1'));
        const body = await response.text();

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Disposition')).toContain('attachment; filename=');
        expect(JSON.parse(body)).toMatchObject({
            attempts: [
                { id: 'attempt-1' },
                { id: 'attempt-2' },
            ],
        });
        expect(mockLoadLearningStatsExportAttempts).toHaveBeenNthCalledWith(1, { supabase: true }, 'user-1', {
            cursor: null,
            limit: undefined,
        });
        expect(mockLoadLearningStatsExportAttempts).toHaveBeenNthCalledWith(2, { supabase: true }, 'user-1', {
            cursor: 'cursor-2',
            limit: 500,
        });
    });
});
