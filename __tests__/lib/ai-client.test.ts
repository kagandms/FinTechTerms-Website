/**
 * @jest-environment jsdom
 */

import { fetchAiChatResponse, isRecoverableAiClientError } from '@/lib/ai/client';

const mockGetSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
    getSupabaseClient: () => ({
        auth: {
            getSession: (...args: unknown[]) => mockGetSession(...args),
        },
    }),
}));

jest.mock('@/lib/ai-copy', () => ({
    getAiUiCopy: () => ({
        studyCoachCompleteProfile: 'Complete profile',
        genericError: 'Generic AI error',
    }),
}));

describe('AI client timeout handling', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.useFakeTimers();
        mockGetSession.mockResolvedValue({
            data: {
                session: null,
            },
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    it('rejects with a timeout error when the AI request does not settle', async () => {
        global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_, reject) => {
            const signal = init?.signal;
            signal?.addEventListener('abort', () => {
                reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
            });
        })) as typeof fetch;

        const request = fetchAiChatResponse({
            language: 'en',
            message: 'What is a stock exchange?',
            history: [],
        });
        const expectation = expect(request).rejects.toThrow('AI request timed out. Please try again.');

        await jest.advanceTimersByTimeAsync(20_000);

        await expectation;
    });

    it('marks client-side timeout errors as recoverable', async () => {
        global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
                reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
            });
        })) as typeof fetch;

        const request = fetchAiChatResponse({
            language: 'en',
            message: 'What is a stock exchange?',
            history: [],
        });
        const expectation = request.catch((error: unknown) => {
            expect(isRecoverableAiClientError(error)).toBe(true);
        });

        await jest.advanceTimersByTimeAsync(20_000);

        await expectation;
    });
});
