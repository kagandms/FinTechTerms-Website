/**
 * @jest-environment node
 */

const mockCaptureRequestError = jest.fn();
const mockGetTraceData = jest.fn();

jest.mock('@sentry/nextjs', () => ({
    captureRequestError: (...args: unknown[]) => mockCaptureRequestError(...args),
    getTraceData: (...args: unknown[]) => mockGetTraceData(...args),
}));

jest.mock('@/lib/server-env', () => ({
    assertProductionRuntimeEnv: jest.fn(),
}));

const restoreEnvValue = (key: string, value: string | undefined): void => {
    if (value === undefined) {
        delete process.env[key];
        return;
    }

    process.env[key] = value;
};

describe('instrumentation trace propagation', () => {
    const originalFetch = globalThis.fetch;
    const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NEXT_PUBLIC_SITE_URL = 'https://fintechterms.com';
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
        mockGetTraceData.mockReturnValue({
            'sentry-trace': 'trace-id-span-id-1',
            baggage: 'sentry-environment=production',
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        restoreEnvValue('NEXT_PUBLIC_SITE_URL', originalSiteUrl);
        restoreEnvValue('NEXT_PUBLIC_SUPABASE_URL', originalSupabaseUrl);
    });

    it('adds distributed trace headers to configured downstream origins', async () => {
        const { createTracePropagationInit } = await import('@/instrumentation');

        const init = createTracePropagationInit('https://project.supabase.co/rest/v1/terms', {
            headers: {
                accept: 'application/json',
            },
        });
        const headers = new Headers(init?.headers);

        expect(headers.get('accept')).toBe('application/json');
        expect(headers.get('sentry-trace')).toBe('trace-id-span-id-1');
        expect(headers.get('baggage')).toBe('sentry-environment=production');
        expect(headers.get('traceparent')).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    });

    it('keeps caller-provided trace headers intact', async () => {
        const { createTracePropagationInit } = await import('@/instrumentation');

        const init = createTracePropagationInit('https://openrouter.ai/api/v1/chat/completions', {
            headers: {
                'sentry-trace': 'caller-trace-header',
            },
        });
        const headers = new Headers(init?.headers);

        expect(headers.get('sentry-trace')).toBe('caller-trace-header');
        expect(headers.get('traceparent')).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    });

    it('leaves unconfigured third-party origins untouched', async () => {
        const { createTracePropagationInit } = await import('@/instrumentation');
        const originalInit: RequestInit = {
            headers: {
                accept: 'application/json',
            },
        };

        const init = createTracePropagationInit('https://example.com/api', originalInit);

        expect(init).toBe(originalInit);
        expect(mockGetTraceData).not.toHaveBeenCalled();
    });

    it('patches global fetch only once', async () => {
        const fetchMock = jest.fn((
            _input: Parameters<typeof fetch>[0],
            _init?: Parameters<typeof fetch>[1]
        ): ReturnType<typeof fetch> => Promise.resolve(new Response('{}')));
        globalThis.fetch = fetchMock as typeof fetch;
        const { registerTracePropagation } = await import('@/instrumentation');

        registerTracePropagation();
        const patchedFetch = globalThis.fetch;
        await globalThis.fetch('https://project.supabase.co/rest/v1/terms');
        registerTracePropagation();

        expect(globalThis.fetch).toBe(patchedFetch);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const fetchCall = fetchMock.mock.calls.at(0);
        if (!fetchCall) {
            throw new Error('Expected fetch to be called.');
        }

        const [, init] = fetchCall;
        const headers = new Headers(init?.headers);
        expect(headers.get('sentry-trace')).toBe('trace-id-span-id-1');
    });
});
