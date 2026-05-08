/**
 * @jest-environment node
 */

import {
    createRequestId,
    createTimeoutFetch,
    getClientIp,
    successResponse,
} from '@/lib/api-response';

describe('getClientIp', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('prefers trusted direct IP headers over x-forwarded-for', () => {
        process.env.VERCEL_URL = 'fintechterms.vercel.app';
        const request = new Request('http://localhost:3000/api/test', {
            headers: {
                'x-forwarded-for': '198.51.100.10, 10.0.0.2',
                'x-real-ip': '203.0.113.25',
            },
        });

        expect(getClientIp(request)).toBe('203.0.113.25');
    });

    it('accepts x-forwarded-for only when a trusted platform env is present', () => {
        process.env.RENDER = 'true';
        const request = new Request('http://localhost:3000/api/test', {
            headers: {
                'x-forwarded-for': '203.0.113.10',
            },
        });

        expect(getClientIp(request)).toBe('203.0.113.10');
    });

    it('falls back to unknown for forwarded headers without a trusted platform env', () => {
        const request = new Request('http://localhost:3000/api/test', {
            headers: {
                'x-forwarded-for': '203.0.113.10',
                'x-real-ip': '203.0.113.25',
            },
        });

        expect(getClientIp(request)).toBe('unknown');
    });
});

describe('route performance metrics', () => {
    let consoleInfoSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleInfoSpy.mockRestore();
    });

    it('emits a successful route metric when a registered request completes', () => {
        const request = new Request('http://localhost:3000/api/progress', {
            method: 'GET',
            headers: {
                'x-request-id': 'req-progress-1',
            },
        });

        const requestId = createRequestId(request);
        const response = successResponse({ status: 'ok' }, requestId);

        expect(response.headers.get('X-Request-Id')).toBe('req-progress-1');
        expect(consoleInfoSpy).toHaveBeenCalledTimes(1);

        const [rawMetric] = consoleInfoSpy.mock.calls[0] as [string];
        const metric = JSON.parse(rawMetric) as {
            message?: string;
            route?: string;
            requestId?: string;
            method?: string;
            status?: number;
            duration_ms?: number;
        };

        expect(metric).toMatchObject({
            message: 'API_ROUTE_COMPLETED',
            route: '/api/progress',
            requestId: 'req-progress-1',
            method: 'GET',
            status: 200,
        });
        expect(typeof metric.duration_ms).toBe('number');
    });
});

describe('upstream performance metrics', () => {
    let consoleInfoSpy: jest.SpyInstance;
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
        fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, {
            status: 204,
        }));
    });

    afterEach(() => {
        consoleInfoSpy.mockRestore();
        fetchSpy.mockRestore();
    });

    it('emits dependency timing when instrumented timeout fetch succeeds', async () => {
        const timeoutFetch = createTimeoutFetch(1_000, {
            dependency: 'openrouter',
            route: '/api/ai/chat',
            requestId: 'req-ai-1',
        });

        const response = await timeoutFetch('https://openrouter.example/v1/chat', {
            method: 'POST',
        });

        expect(response.status).toBe(204);
        expect(consoleInfoSpy).toHaveBeenCalledTimes(1);

        const [rawMetric] = consoleInfoSpy.mock.calls[0] as [string];
        const metric = JSON.parse(rawMetric) as {
            message?: string;
            dependency?: string;
            route?: string;
            requestId?: string;
            status?: number;
            outcome?: string;
            duration_ms?: number;
            timeout_ms?: number;
        };

        expect(metric).toMatchObject({
            message: 'UPSTREAM_REQUEST_COMPLETED',
            dependency: 'openrouter',
            route: '/api/ai/chat',
            requestId: 'req-ai-1',
            status: 204,
            outcome: 'success',
            timeout_ms: 1000,
        });
        expect(typeof metric.duration_ms).toBe('number');
    });
});
