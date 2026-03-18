/**
 * @jest-environment node
 */

import {
    getPriorityTermCount,
    getSeoTermById,
    getSeoTermBySlug,
    listGlossaryTerms,
    listPrioritySeoTerms,
    listStaticContributorSlugs,
    listStaticPriorityTermSlugs,
    listStaticTopicSlugs,
    listSeoTerms,
} from '@/lib/public-seo-catalog';

describe('public seo catalog', () => {
    it('keeps slugs unique across the full catalog', async () => {
        const terms = await listSeoTerms();
        const uniqueSlugs = new Set(terms.map((term) => term.slug));

        expect(uniqueSlugs.size).toBe(terms.length);
    });

    it('resolves new gap terms through both id and slug lookups', async () => {
        const byId = await getSeoTermById('term_9001');
        const bySlug = await getSeoTermBySlug('merchant-of-record');

        expect(byId?.term_en).toBe('Merchant of Record');
        expect(bySlug?.id).toBe('term_9001');
        expect(bySlug?.index_priority).toBe('high');
    });

    it('sorts localized glossary terms by locale-aware label', async () => {
        const terms = await listGlossaryTerms('en');

        expect(terms[0]?.term_en.localeCompare(terms[1]?.term_en ?? '', 'en')).toBeLessThanOrEqual(0);
    });

    it('keeps an explicit top-100 priority registry with minimum ontology completeness', async () => {
        const priorityTerms = await listPrioritySeoTerms(200);

        expect(getPriorityTermCount()).toBe(100);
        expect(priorityTerms.length).toBe(100);
        expect(priorityTerms.every((term) => term.source_refs.length >= 3)).toBe(true);
        expect(priorityTerms.every((term) => term.related_term_ids.length >= 3)).toBe(true);
        expect(priorityTerms.every((term) => term.comparison_term_id)).toBe(true);
        expect(priorityTerms.every((term) => term.prerequisite_term_id)).toBe(true);
    });

    it('returns finite topic and contributor slug catalogs for static generation', async () => {
        const [topicSlugs, contributorSlugs] = await Promise.all([
            listStaticTopicSlugs(),
            listStaticContributorSlugs(),
        ]);

        expect(topicSlugs).toHaveLength(8);
        expect(topicSlugs).toContain('cards-payments');
        expect(contributorSlugs).toHaveLength(2);
        expect(contributorSlugs).toContain('kagan-samet-durmus');
    });

    it('returns the full priority-term slug set for static glossary generation', async () => {
        const priorityTermSlugs = await listStaticPriorityTermSlugs();

        expect(priorityTermSlugs).toHaveLength(getPriorityTermCount());
        expect(priorityTermSlugs[0]).toBeDefined();
        expect(priorityTermSlugs).toContain('merchant-of-record');
    });
});
