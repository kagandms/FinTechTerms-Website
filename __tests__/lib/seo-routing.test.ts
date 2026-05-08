/**
 * @jest-environment node
 */

import {
    buildAbsoluteLocaleAlternates,
    buildAbsolutePublicLocaleAlternates,
    buildAbsoluteXDefaultAlternates,
    buildGlossaryOpenGraphImagePath,
    buildLocaleAlternates,
    buildLocalePath,
    buildPublicOpenGraphImagePath,
    buildSiblingLocalePath,
    formatSeoTitle,
} from '@/lib/seo-routing';

describe('seo routing helpers', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            NEXT_PUBLIC_SITE_URL: 'https://fintechterms.example.com',
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('builds locale paths without query params', () => {
        expect(buildLocalePath('ru')).toBe('/ru');
        expect(buildLocalePath('en', '/glossary/tokenization')).toBe('/en/glossary/tokenization');
        expect(buildLocalePath('tr', 'sources')).toBe('/tr/sources');
    });

    it('builds localized alternates for the same relative path', () => {
        expect(buildLocaleAlternates('/glossary/tokenization')).toEqual({
            ru: '/ru/glossary/tokenization',
            en: '/en/glossary/tokenization',
            tr: '/tr/glossary/tokenization',
        });
    });

    it('builds absolute localized alternates for metadata consumers', () => {
        expect(buildAbsoluteLocaleAlternates('/glossary/tokenization')).toEqual({
            ru: 'https://fintechterms.example.com/ru/glossary/tokenization',
            en: 'https://fintechterms.example.com/en/glossary/tokenization',
            tr: 'https://fintechterms.example.com/tr/glossary/tokenization',
        });
        expect(buildAbsolutePublicLocaleAlternates('/glossary/tokenization')).toEqual({
            'x-default': 'https://fintechterms.example.com',
            ru: 'https://fintechterms.example.com/ru/glossary/tokenization',
            en: 'https://fintechterms.example.com/en/glossary/tokenization',
            tr: 'https://fintechterms.example.com/tr/glossary/tokenization',
        });
        expect(buildAbsoluteXDefaultAlternates()).toEqual({
            'x-default': 'https://fintechterms.example.com',
            ru: 'https://fintechterms.example.com/ru',
            en: 'https://fintechterms.example.com/en',
            tr: 'https://fintechterms.example.com/tr',
        });
    });

    it('uses the root URL as x-default for locale home alternates', () => {
        expect(buildAbsolutePublicLocaleAlternates()).toEqual({
            'x-default': 'https://fintechterms.example.com',
            ru: 'https://fintechterms.example.com/ru',
            en: 'https://fintechterms.example.com/en',
            tr: 'https://fintechterms.example.com/tr',
        });
    });

    it('builds the published glossary Open Graph image route for route-group metadata files', () => {
        expect(buildGlossaryOpenGraphImagePath('ru', 'tokenization')).toBe(
            '/ru/glossary/tokenization/opengraph-image-1miyui'
        );
        expect(buildPublicOpenGraphImagePath('en')).toBe('/en/opengraph-image-o1kegr');
    });

    it('rewrites localized sibling paths across public routes', () => {
        expect(buildSiblingLocalePath('/ru', 'en')).toBe('/en');
        expect(buildSiblingLocalePath('/ru/about', 'tr')).toBe('/tr/about');
        expect(buildSiblingLocalePath('/ru/glossary/tokenization', 'en')).toBe('/en/glossary/tokenization');
        expect(buildSiblingLocalePath('/ru/topics/cards-payments', 'tr')).toBe('/tr/topics/cards-payments');
        expect(buildSiblingLocalePath('/ru/authors/kagan-samet-durmus', 'en')).toBe('/en/authors/kagan-samet-durmus');
        expect(buildSiblingLocalePath('/ru/editorial-policy', 'en')).toBe('/en/editorial-policy');
        expect(buildSiblingLocalePath('/ru/corrections', 'tr')).toBe('/tr/corrections');
    });

    it('falls back to locale home when the current pathname cannot be rewritten', () => {
        expect(buildSiblingLocalePath(null, 'en')).toBe('/en');
        expect(buildSiblingLocalePath('', 'ru')).toBe('/ru');
        expect(buildSiblingLocalePath('/search', 'tr')).toBe('/tr');
    });

    it('avoids duplicating the brand suffix in title formatting', () => {
        expect(formatSeoTitle('Tokenization')).toBe('Tokenization | FinTechTerms');
        expect(formatSeoTitle('Tokenization | FinTechTerms')).toBe('Tokenization | FinTechTerms');
    });

    it('keeps formatted SEO titles within the public title budget', () => {
        const title = formatSeoTitle('Authorization meaning, approval rate, and card payment flow');

        expect(title.length).toBeLessThanOrEqual(60);
        expect(title).toBe('Authorization meaning, approval rate | FinTechTerms');
    });
});
