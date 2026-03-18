/**
 * @jest-environment node
 */

describe('legacy public route helpers', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('prefers an explicit lang query over cookie and Accept-Language', () => {
        jest.isolateModules(() => {
            const { resolveLegacyPublicLocale } = require('@/lib/legacy-public-routes');

            expect(resolveLegacyPublicLocale({
                queryLanguage: 'en',
                cookieLanguage: 'tr',
                acceptLanguage: 'ru-RU,ru;q=0.9',
            })).toBe('en');
        });
    });

    it('builds static redirect paths with the configured default locale fallback', () => {
        process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE = 'tr';

        jest.isolateModules(() => {
            const { buildLegacyStaticRedirectPath } = require('@/lib/legacy-public-routes');

            expect(buildLegacyStaticRedirectPath('/about', {})).toBe('/tr/about');
            expect(buildLegacyStaticRedirectPath('/methodology', {})).toBe('/tr/methodology');
        });
    });

    it('builds term redirects from legacy ids and returns null for unknown ids', () => {
        jest.isolateModules(() => {
            const { buildLegacyTermRedirectPath } = require('@/lib/legacy-public-routes');

            expect(buildLegacyTermRedirectPath({
                termId: 'term_145',
                queryLanguage: 'ru',
            })).toBe('/ru/glossary/tokenization');
            expect(buildLegacyTermRedirectPath({
                termId: 'missing-term',
                queryLanguage: 'en',
            })).toBeNull();
        });
    });
});
