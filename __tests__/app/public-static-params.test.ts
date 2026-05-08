/**
 * @jest-environment node
 */

import {
    listGlossaryLetterGroups,
    listStaticContributorSlugs,
    listSeoTerms,
    listStaticTopicSlugs,
} from '@/lib/public-seo-catalog';
import { PUBLIC_LOCALES } from '@/lib/seo-routing';

describe('public SEO static params', () => {
    it('topic routes prebuild all known topic slugs and disable dynamic params', async () => {
        const routeModule = await import('@/app/(public)/[locale]/topics/[topicSlug]/page');
        const topicSlugs = await listStaticTopicSlugs();
        const expectedParams = PUBLIC_LOCALES.flatMap((locale) => (
            topicSlugs.map((topicSlug) => ({ locale, topicSlug }))
        ));

        expect(routeModule.dynamicParams).toBe(false);
        await expect(routeModule.generateStaticParams()).resolves.toEqual(expectedParams);
    });

    it('topic term index routes prebuild all known topic slugs and disable dynamic params', async () => {
        const routeModule = await import('@/app/(public)/[locale]/topics/[topicSlug]/terms/page');
        const topicSlugs = await listStaticTopicSlugs();
        const expectedParams = PUBLIC_LOCALES.flatMap((locale) => (
            topicSlugs.map((topicSlug) => ({ locale, topicSlug }))
        ));

        expect(routeModule.dynamicParams).toBe(false);
        await expect(routeModule.generateStaticParams()).resolves.toEqual(expectedParams);
    });

    it('author routes prebuild all known contributor slugs and disable dynamic params', async () => {
        const routeModule = await import('@/app/(public)/[locale]/authors/[authorSlug]/page');
        const contributorSlugs = await listStaticContributorSlugs();
        const expectedParams = PUBLIC_LOCALES.flatMap((locale) => (
            contributorSlugs.map((authorSlug) => ({ locale, authorSlug }))
        ));

        expect(routeModule.dynamicParams).toBe(false);
        await expect(routeModule.generateStaticParams()).resolves.toEqual(expectedParams);
    });

    it('glossary letter routes prebuild localized letter groups and disable dynamic params', async () => {
        const routeModule = await import('@/app/(public)/[locale]/glossary/letter/[group]/page');
        const expectedParams = (await Promise.all(PUBLIC_LOCALES.map(async (locale) => (
            (await listGlossaryLetterGroups(locale)).map((group) => ({ locale, group: group.key }))
        )))).flat();

        expect(routeModule.dynamicParams).toBe(false);
        await expect(routeModule.generateStaticParams()).resolves.toEqual(expectedParams);
        expect(expectedParams).toContainEqual({ locale: 'en', group: 'a' });
    });

    it('glossary routes prebuild the full localized term corpus and disable dynamic params', async () => {
        const routeModule = await import('@/app/(public)/[locale]/glossary/[slug]/page');
        const terms = await listSeoTerms();
        const expectedParams = PUBLIC_LOCALES.flatMap((locale) => (
            terms.map((term) => ({ locale, slug: term.slug }))
        ));

        expect(routeModule.dynamicParams).toBe(false);
        await expect(routeModule.generateStaticParams()).resolves.toEqual(expectedParams);
        expect(expectedParams).toHaveLength(terms.length * PUBLIC_LOCALES.length);
        expect(expectedParams).toContainEqual({ locale: 'ru', slug: 'market-index' });
        expect(expectedParams).not.toContainEqual({ locale: 'ru', slug: 'index' });
    });
});
