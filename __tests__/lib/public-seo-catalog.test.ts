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
import { searchIntentMetadataOverrides } from '@/data/seo/search-intent-overrides';

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
        const genericSearchSourceIds = new Set(['google-helpful-content', 'google-title-links']);

        expect(getPriorityTermCount()).toBe(100);
        expect(priorityTerms.length).toBe(100);
        expect(priorityTerms.every((term) => term.source_refs.length >= 3)).toBe(true);
        expect(priorityTerms.every((term) => (
            term.source_refs.every((sourceId) => !genericSearchSourceIds.has(sourceId))
        ))).toBe(true);
        expect(priorityTerms.every((term) => term.related_term_ids.length >= 3)).toBe(true);
        expect(priorityTerms.every((term) => term.comparison_term_id)).toBe(true);
        expect(priorityTerms.every((term) => term.prerequisite_term_id)).toBe(true);
    });

    it('enriches standard long-tail terms with topic-aware public SEO copy', async () => {
        const terms = await listSeoTerms();
        const standardTerm = terms.find((term) => term.index_priority !== 'high');

        expect(standardTerm?.expanded_definition.en).toContain('Within the');
        expect(standardTerm?.why_it_matters.en).not.toContain('product decisions, and industry communication');
        expect(standardTerm?.risks_and_pitfalls.en.length).toBeGreaterThan(80);
        expect(standardTerm?.seo_description.en.length).toBeGreaterThanOrEqual(120);
        expect(standardTerm?.seo_description.ru.length).toBeGreaterThanOrEqual(120);
        expect(standardTerm?.seo_description.tr.length).toBeGreaterThanOrEqual(120);
        expect(standardTerm?.seo_title.en.length).toBeLessThanOrEqual(44);
        expect([
            standardTerm?.expanded_definition.en,
            standardTerm?.why_it_matters.en,
            standardTerm?.how_it_works.en,
            standardTerm?.risks_and_pitfalls.en,
            standardTerm?.regional_notes.en,
        ].join(' ').split(/\s+/).length).toBeGreaterThanOrEqual(180);
    });

    it('separates metadata intent for known cannibalization-prone term pairs', async () => {
        const terms = await listSeoTerms();
        const slugs = Object.keys(searchIntentMetadataOverrides);
        const reviewedTerms = slugs.map((slug) => terms.find((term) => term.slug === slug));

        expect(reviewedTerms.every(Boolean)).toBe(true);

        for (const locale of ['en', 'ru', 'tr'] as const) {
            const titleSet = new Set(reviewedTerms.map((term) => term?.seo_title[locale]));
            const descriptionSet = new Set(reviewedTerms.map((term) => term?.seo_description[locale]));

            expect(titleSet.size).toBe(reviewedTerms.length);
            expect(descriptionSet.size).toBe(reviewedTerms.length);
        }
    });

    it('derives public SEO freshness from source and reviewed override dates', async () => {
        const terms = await listSeoTerms();
        const kycTerm = terms.find((term) => term.slug === 'kyc');
        const uniqueUpdatedAtValues = new Set(terms.map((term) => term.updated_at));

        expect(uniqueUpdatedAtValues.size).toBeGreaterThan(1);
        expect(kycTerm?.reviewed_at).toBe('2026-05-04T00:00:00.000Z');
        expect(kycTerm?.updated_at).toBe('2026-05-04T00:00:00.000Z');
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
