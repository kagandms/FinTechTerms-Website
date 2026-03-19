/**
 * @jest-environment node
 */

export {};

const mockResolveAuthenticatedUser = jest.fn();
const mockGetServerEnv = jest.fn();
const mockCaptureException = jest.fn(() => 'event_123');
const mockCaptureMessage = jest.fn(() => 'message_123');
const mockFlush = jest.fn().mockResolvedValue(true);
const mockSetLevel = jest.fn();
const mockSetTag = jest.fn();
const mockSetUser = jest.fn();
const mockSetExtra = jest.fn();

jest.mock('@/lib/supabaseAdmin', () => ({
    resolveAuthenticatedUser: (request: Request) => mockResolveAuthenticatedUser(request),
}));

jest.mock('@/lib/env', () => ({
    getServerEnv: () => mockGetServerEnv(),
}));

jest.mock('@sentry/nextjs', () => ({
    withScope: (callback: (scope: {
        setLevel: typeof mockSetLevel;
        setTag: typeof mockSetTag;
        setUser: typeof mockSetUser;
        setExtra: typeof mockSetExtra;
    }) => string) => callback({
        setLevel: mockSetLevel,
        setTag: mockSetTag,
        setUser: mockSetUser,
        setExtra: mockSetExtra,
    }),
    captureException: mockCaptureException,
    captureMessage: mockCaptureMessage,
    flush: mockFlush,
}));

const createRequest = () => new Request('http://localhost:3000/api/admin/sentry-smoke', {
    method: 'POST',
});

describe('sentry smoke route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetServerEnv.mockReturnValue({
            adminEmail: 'admin@example.com',
            adminUserIds: ['admin-user'],
            sentryDsn: 'https://example.ingest.sentry.io/123',
            sentryEnvironment: 'staging',
        });
    });

    it('rejects unauthenticated requests', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue(null);

        const { POST } = await import('@/app/api/admin/sentry-smoke/route');
        const response = await POST(createRequest());
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toMatchObject({
            code: 'UNAUTHORIZED',
            retryable: false,
        });
    });

    it('rejects non-admin users', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
        });

        const { POST } = await import('@/app/api/admin/sentry-smoke/route');
        const response = await POST(createRequest());
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            code: 'FORBIDDEN',
            retryable: false,
        });
    });

    it('returns an event id for an authenticated admin', async () => {
        mockResolveAuthenticatedUser.mockResolvedValue({
            id: 'admin-user',
            email: 'admin@example.com',
        });

        const { POST } = await import('@/app/api/admin/sentry-smoke/route');
        const response = await POST(createRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            ok: true,
            eventId: 'event_123',
        });
        expect(mockCaptureException).toHaveBeenCalledTimes(1);
        expect(mockFlush).toHaveBeenCalledWith(2000);
    });
});
