/**
 * @jest-environment node
 */

import {
    listStaticContributorSlugs,
    listStaticPriorityTermSlugs,
    listStaticTopicSlugs,
} from '@/lib/public-seo-catalog';

describe('public SEO static params', () => {
    it('topic routes prebuild all known topic slugs and disable dynamic params', async () => {
        const routeModule = await import('@/app/(public)/[locale]/topics/[topicSlug]/page');
        const expectedParams = (await listStaticTopicSlugs()).map((topicSlug) => ({ topicSlug }));

        expect(routeModule.dynamicParams).toBe(false);
        await expect(routeModule.generateStaticParams()).resolves.toEqual(expectedParams);
    });

    it('author routes prebuild all known contributor slugs and disable dynamic params', async () => {
        const routeModule = await import('@/app/(public)/[locale]/authors/[authorSlug]/page');
        const expectedParams = (await listStaticContributorSlugs()).map((authorSlug) => ({ authorSlug }));

        expect(routeModule.dynamicParams).toBe(false);
        await expect(routeModule.generateStaticParams()).resolves.toEqual(expectedParams);
    });

    it('glossary routes prebuild the priority term subset and keep fallback enabled', async () => {
        const routeModule = await import('@/app/(public)/[locale]/glossary/[slug]/page');
        const expectedParams = (await listStaticPriorityTermSlugs()).map((slug) => ({ slug }));

        expect(routeModule.dynamicParams).toBe(true);
        await expect(routeModule.generateStaticParams()).resolves.toEqual(expectedParams);
        expect(expectedParams).toHaveLength(100);
    });
});
