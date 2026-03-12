/**
 * @jest-environment node
 */

describe('language configuration helpers', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('uses NEXT_PUBLIC_DEFAULT_LANGUAGE when it is configured to a supported locale', () => {
        process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE = 'en';

        jest.isolateModules(() => {
            const { DEFAULT_LANGUAGE } = require('@/lib/language');
            expect(DEFAULT_LANGUAGE).toBe('en');
        });
    });

    it('prefers the language cookie over Accept-Language when both are present', () => {
        jest.isolateModules(() => {
            const { resolvePreferredLanguage } = require('@/lib/language');

            expect(resolvePreferredLanguage({
                cookieValue: 'tr',
                acceptLanguage: 'en-US,en;q=0.9,ru;q=0.8',
            })).toBe('tr');
        });
    });

    it('falls back to the highest quality Accept-Language match when no cookie exists', () => {
        jest.isolateModules(() => {
            const { resolvePreferredLanguage } = require('@/lib/language');

            expect(resolvePreferredLanguage({
                acceptLanguage: 'fr-FR;q=0.5,en-US;q=0.9,tr;q=0.8',
            })).toBe('en');
        });
    });
});
