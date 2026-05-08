/**
 * @jest-environment node
 */

const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
const mockSetExtra = jest.fn();
const mockSetLevel = jest.fn();
const mockSetTag = jest.fn();
const mockSetUser = jest.fn();
const mockWithScope = jest.fn((callback: (scope: unknown) => void) => {
    callback({
        setExtra: mockSetExtra,
        setLevel: mockSetLevel,
        setTag: mockSetTag,
        setUser: mockSetUser,
    });
});

jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
    withScope: (callback: (scope: unknown) => void) => mockWithScope(callback),
}));

describe('logger', () => {
    let consoleInfoSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleInfoSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('does not send info-level messages to Sentry', async () => {
        const { logger } = await import('@/lib/logger');

        logger.info('AUTH_LOGIN_SUCCEEDED', {
            route: 'POST /api/auth/login',
            userId: 'user-1',
        });

        expect(mockWithScope).not.toHaveBeenCalled();
        expect(mockCaptureMessage).not.toHaveBeenCalled();
        expect(mockCaptureException).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('still sends warning messages to Sentry', async () => {
        const { logger } = await import('@/lib/logger');

        logger.warn('RATE_LIMITER_UNAVAILABLE', {
            route: 'POST /api/favorites',
        });

        expect(mockWithScope).toHaveBeenCalledTimes(1);
        expect(mockSetLevel).toHaveBeenCalledWith('warning');
        expect(mockCaptureMessage).toHaveBeenCalledWith('RATE_LIMITER_UNAVAILABLE', 'warning');
    });

    it('writes performance events without sending them to Sentry', async () => {
        const { logger } = await import('@/lib/logger');

        logger.performance('API_ROUTE_COMPLETED', {
            route: '/api/progress',
            requestId: 'req-1',
            method: 'GET',
            status: 200,
            duration_ms: 42,
        });

        expect(mockWithScope).not.toHaveBeenCalled();
        expect(mockCaptureMessage).not.toHaveBeenCalled();
        expect(mockCaptureException).not.toHaveBeenCalled();
        expect(consoleInfoSpy).toHaveBeenCalledWith(JSON.stringify({
            level: 'info',
            message: 'API_ROUTE_COMPLETED',
            route: '/api/progress',
            requestId: 'req-1',
            method: 'GET',
            status: 200,
            duration_ms: 42,
        }));
    });
});
