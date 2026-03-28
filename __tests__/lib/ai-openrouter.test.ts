describe('generateStructuredAiResponse', () => {
    const originalEnv = process.env;
    const originalFetch = global.fetch;

    class MockHeaders {
        private readonly values = new Map<string, string>();

        constructor(init?: Record<string, string>) {
            Object.entries(init ?? {}).forEach(([key, value]) => {
                this.values.set(key.toLowerCase(), value);
            });
        }

        get(key: string): string | null {
            return this.values.get(key.toLowerCase()) ?? null;
        }
    }

    class MockRequest {
        readonly headers: MockHeaders;

        constructor(_url: string, init?: { headers?: Record<string, string> }) {
            this.headers = new MockHeaders(init?.headers);
        }
    }

    class MockResponse {
        readonly status: number;
        readonly ok: boolean;
        private readonly rawBody: string;

        constructor(body: string, init: { status: number }) {
            this.rawBody = body;
            this.status = init.status;
            this.ok = init.status >= 200 && init.status < 300;
        }

        async text(): Promise<string> {
            return this.rawBody;
        }
    }

    beforeEach(() => {
        jest.resetModules();
        Object.assign(globalThis, { Request: MockRequest, Response: MockResponse, Headers: MockHeaders });
        process.env = {
            ...originalEnv,
            NODE_ENV: 'test',
            NEXT_PUBLIC_SITE_URL: 'https://fintechterms.com',
            NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
            OPENROUTER_API_KEY: 'openrouter-key',
            AI_PRIMARY_MODEL: 'primary-model',
            AI_FALLBACK_MODELS: 'fallback-model',
            OPENROUTER_REFERER: 'https://fintechterms.com',
            OPENROUTER_APP_NAME: 'FinTechTerms',
        };
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('falls back to the next model when the primary model is rate limited', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(new MockResponse(JSON.stringify({
                error: {
                    message: 'rate limited',
                },
            }), {
                status: 429,
            }))
            .mockResolvedValueOnce(new MockResponse(JSON.stringify({
                choices: [
                    {
                        message: {
                            content: '{"answer":"ok"}',
                        },
                    },
                ],
            }), {
                status: 200,
            }));

        global.fetch = fetchMock as typeof fetch;

        const { z } = await import('zod');
        const { generateStructuredAiResponse } = await import('@/lib/ai/openrouter');

        const result = await generateStructuredAiResponse({
            route: '/api/test',
            requestId: 'req-1',
            messages: [{ role: 'user', content: 'test' }],
            outputContract: '{ "answer": string }',
            schema: z.object({
                answer: z.string(),
            }),
        });

        expect(result.data).toEqual({ answer: 'ok' });
        expect(result.model).toBe('fallback-model');
        expect(result.usedFallback).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
