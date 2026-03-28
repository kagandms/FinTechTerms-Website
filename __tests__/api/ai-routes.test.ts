const mockGenerateStructuredAiResponse = jest.fn();
const mockGetAiCatalogTermById = jest.fn();
const mockIsAiDomainQuestion = jest.fn();
const mockFindRelevantAiTerms = jest.fn();
const mockFormatTermContextForAi = jest.fn(() => 'term-context');
const mockResolveRequestMemberEntitlements = jest.fn();
const mockAiAssistantCheck = jest.fn();
const mockAiCoachCheck = jest.fn();

jest.mock('@/lib/ai/openrouter', () => ({
    generateStructuredAiResponse: mockGenerateStructuredAiResponse,
}));

jest.mock('@/lib/ai/grounding', () => ({
    getAiCatalogTermById: mockGetAiCatalogTermById,
    isAiDomainQuestion: mockIsAiDomainQuestion,
    findRelevantAiTerms: mockFindRelevantAiTerms,
    formatTermContextForAi: mockFormatTermContextForAi,
}));

jest.mock('@/lib/server-member-entitlements', () => ({
    resolveRequestMemberEntitlements: mockResolveRequestMemberEntitlements,
}));

jest.mock('@/lib/api-response', () => ({
    createRequestId: () => 'req-1',
    getClientIp: () => '127.0.0.1',
    successResponse: (data: unknown, _requestId: string, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        json: async () => data,
    }),
    errorResponse: (options: { status: number; code: string; message: string; retryable: boolean }) => ({
        status: options.status,
        json: async () => ({
            code: options.code,
            message: options.message,
            retryable: options.retryable,
        }),
    }),
    handleRouteError: (_error: unknown, options: { status?: number; code?: string; message?: string; retryable?: boolean }) => ({
        status: options.status ?? 500,
        json: async () => ({
            code: options.code ?? 'UNEXPECTED_ERROR',
            message: options.message ?? 'Unexpected route error.',
            retryable: options.retryable ?? false,
        }),
    }),
}));

jest.mock('@/lib/rate-limiter', () => ({
    aiAssistantRouteRateLimiter: {
        check: (...args: unknown[]) => mockAiAssistantCheck(...args),
    },
    aiCoachRouteRateLimiter: {
        check: (...args: unknown[]) => mockAiCoachCheck(...args),
    },
    isRateLimiterUnavailable: (result: { unavailable?: boolean }) => result.unavailable === true,
}));

describe('AI routes', () => {
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

        set(key: string, value: string): void {
            this.values.set(key.toLowerCase(), value);
        }
    }

    class MockRequest {
        readonly headers: MockHeaders;
        private readonly body: string | undefined;

        constructor(_url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
            this.headers = new MockHeaders(init?.headers);
            this.body = init?.body;
        }

        async json(): Promise<unknown> {
            return this.body ? JSON.parse(this.body) : null;
        }
    }

    class MockResponse {
        readonly status: number;
        readonly ok: boolean;
        readonly headers: MockHeaders;
        private readonly rawBody: string;

        static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
            return new MockResponse(JSON.stringify(body), init);
        }

        constructor(body: string, init?: { status?: number; headers?: Record<string, string> }) {
            this.rawBody = body;
            this.status = init?.status ?? 200;
            this.ok = this.status >= 200 && this.status < 300;
            this.headers = new MockHeaders(init?.headers);
        }

        async json(): Promise<unknown> {
            return this.rawBody ? JSON.parse(this.rawBody) : null;
        }

        async text(): Promise<string> {
            return this.rawBody;
        }
    }

    beforeAll(() => {
        Object.assign(globalThis, { Request: MockRequest, Response: MockResponse, Headers: MockHeaders });
    });

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockAiAssistantCheck.mockResolvedValue({
            allowed: true,
            remaining: 10,
            retryAfter: 0,
            unavailable: false,
        });
        mockAiCoachCheck.mockResolvedValue({
            allowed: true,
            remaining: 5,
            retryAfter: 0,
            unavailable: false,
        });
    });

    it('returns term explain output for a valid term', async () => {
        mockGetAiCatalogTermById.mockReturnValue({
            id: 'term-1',
            term_en: 'Bitcoin',
            term_ru: 'Биткоин',
            term_tr: 'Bitcoin',
            definition_en: 'Definition',
            definition_ru: 'Определение',
            definition_tr: 'Tanım',
            example_sentence_en: 'Example',
            example_sentence_ru: 'Пример',
            example_sentence_tr: 'Örnek',
            category: 'Fintech',
            context_tags: {},
            regional_market: 'GLOBAL',
            regional_markets: ['GLOBAL'],
            topic_ids: [],
        });
        mockGenerateStructuredAiResponse.mockResolvedValue({
            data: {
                title: 'Why Bitcoin matters',
                summary: 'Summary',
                keyPoints: ['Point 1', 'Point 2'],
                memoryHook: 'Hook',
            },
            model: 'primary-model',
            usedFallback: false,
        });

        const { POST } = await import('@/app/api/ai/term-explain/route');
        const response = await POST(new MockRequest('http://localhost/api/ai/term-explain', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                termId: 'term-1',
                language: 'en',
                mode: 'simple',
            }),
        }) as unknown as Request);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            explanation: {
                title: 'Why Bitcoin matters',
            },
        });
    });

    it('returns a scoped refusal for chat messages outside the supported domain', async () => {
        mockIsAiDomainQuestion.mockReturnValue(false);

        const { POST } = await import('@/app/api/ai/chat/route');
        const response = await POST(new MockRequest('http://localhost/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                language: 'tr',
                message: 'Bana futbol takımı öner',
                history: [],
            }),
        }) as unknown as Request);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            refused: true,
            relatedTerms: [],
        });
        expect(mockGenerateStructuredAiResponse).not.toHaveBeenCalled();
    });

    it('blocks study coach when the user is not a full member', async () => {
        mockResolveRequestMemberEntitlements.mockResolvedValue({
            user: { id: 'user-1' },
            entitlements: {
                canUseAdvancedAnalytics: false,
            },
        });

        const { POST } = await import('@/app/api/ai/study-coach/route');
        const response = await POST(new MockRequest('http://localhost/api/ai/study-coach', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                language: 'en',
                favorites: [],
                recentWrongTerms: [],
                dueToday: 0,
                accuracy: null,
                currentStreak: 0,
                mistakeQueueCount: 0,
            }),
        }) as unknown as Request);

        expect(response.status).toBe(403);
    });

    it('returns quiz feedback when the term exists', async () => {
        mockGetAiCatalogTermById.mockReturnValue({
            id: 'term-1',
            term_en: 'Bitcoin',
            term_ru: 'Биткоин',
            term_tr: 'Bitcoin',
            definition_en: 'Definition',
            definition_ru: 'Определение',
            definition_tr: 'Tanım',
            example_sentence_en: 'Example',
            example_sentence_ru: 'Пример',
            example_sentence_tr: 'Örnek',
            category: 'Fintech',
            context_tags: {},
            regional_market: 'GLOBAL',
            regional_markets: ['GLOBAL'],
            topic_ids: [],
        });
        mockGenerateStructuredAiResponse.mockResolvedValue({
            data: {
                whyWrong: 'Wrong reason',
                whyCorrect: 'Correct reason',
                memoryHook: 'Hook',
                confusedWith: 'Confused term',
            },
            model: 'primary-model',
            usedFallback: false,
        });

        const { POST } = await import('@/app/api/ai/quiz-feedback/route');
        const response = await POST(new MockRequest('http://localhost/api/ai/quiz-feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                termId: 'term-1',
                language: 'en',
                selectedWrongLabel: 'Ethereum',
            }),
        }) as unknown as Request);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            feedback: {
                whyWrong: 'Wrong reason',
            },
        });
    });

    it.each([
        ['chat', '@/app/api/ai/chat/route', 'http://localhost/api/ai/chat'],
        ['quiz feedback', '@/app/api/ai/quiz-feedback/route', 'http://localhost/api/ai/quiz-feedback'],
        ['term explain', '@/app/api/ai/term-explain/route', 'http://localhost/api/ai/term-explain'],
    ])('returns 400 for invalid JSON on the %s route', async (_label, modulePath, url) => {
        const { POST } = await import(modulePath);
        const response = await POST(new MockRequest(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: '{',
        }) as unknown as Request);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            code: 'INVALID_JSON',
            retryable: false,
        });
    });

    it('returns 400 for invalid JSON on the study coach route', async () => {
        mockResolveRequestMemberEntitlements.mockResolvedValue({
            user: { id: 'user-1' },
            entitlements: {
                canUseAdvancedAnalytics: true,
            },
        });

        const { POST } = await import('@/app/api/ai/study-coach/route');
        const response = await POST(new MockRequest('http://localhost/api/ai/study-coach', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: '{',
        }) as unknown as Request);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            code: 'INVALID_JSON',
            retryable: false,
        });
    });
});
