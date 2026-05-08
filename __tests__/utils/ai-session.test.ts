/**
 * @jest-environment jsdom
 */

import {
    getCachedTermExplainResponse,
    setCachedTermExplainResponse,
} from '@/utils/ai-session';

describe('AI session cache metrics', () => {
    let consoleInfoSpy: jest.SpyInstance;

    beforeEach(() => {
        window.sessionStorage.clear();
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleInfoSpy.mockRestore();
    });

    it('emits miss and hit metrics for the term explain cache', () => {
        const cacheKey = 'term-1:en:simple';
        const payload = {
            title: 'Open banking',
            summary: 'Summary',
            keyPoints: ['Point 1', 'Point 2'],
            memoryHook: 'Hook',
        };

        const missingResponse = getCachedTermExplainResponse(cacheKey);
        setCachedTermExplainResponse(cacheKey, payload);
        const cachedResponse = getCachedTermExplainResponse(cacheKey);

        const metrics = consoleInfoSpy.mock.calls.map(([rawMetric]) => JSON.parse(String(rawMetric)));

        expect(missingResponse).toBeNull();
        expect(cachedResponse).toEqual(payload);
        expect(metrics).toEqual([
            expect.objectContaining({
                message: 'AI_TERM_EXPLAIN_CACHE_MISS',
                cacheStatus: 'miss',
                cacheKey,
            }),
            expect.objectContaining({
                message: 'AI_TERM_EXPLAIN_CACHE_HIT',
                cacheStatus: 'hit',
                cacheKey,
            }),
        ]);
    });
});
