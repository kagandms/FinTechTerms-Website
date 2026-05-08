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
import {
    DEFAULT_GSC_TARGET_TERM_COUNT,
    defaultGscTargetTermSlugs,
    priorityTermRecords,
} from '@/data/seo/priority-terms';

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

    it('publishes the default first-50 priority fallback when no GSC export is available', () => {
        const expectedFallbackSlugs = priorityTermRecords
            .slice(0, DEFAULT_GSC_TARGET_TERM_COUNT)
            .map((record) => record.slug);

        expect(defaultGscTargetTermSlugs).toHaveLength(50);
        expect(new Set(defaultGscTargetTermSlugs).size).toBe(50);
        expect(defaultGscTargetTermSlugs).toEqual(expectedFallbackSlugs);
    });

    it('enriches standard long-tail terms with topic-aware public SEO copy', async () => {
        const terms = await listSeoTerms();
        const standardTerm = terms.find((term) => term.index_priority !== 'high');

        expect(standardTerm?.expanded_definition.en).toContain('Within the');
        expect(standardTerm?.why_it_matters.en).not.toContain('product decisions, and industry communication');
        expect(standardTerm?.risks_and_pitfalls.en.length).toBeGreaterThan(80);
        expect(standardTerm?.seo_description.en.length).toBeLessThanOrEqual(155);
        expect(standardTerm?.seo_description.ru.length).toBeLessThanOrEqual(155);
        expect(standardTerm?.seo_description.tr.length).toBeLessThanOrEqual(155);
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

    it('keeps source verification dates separate from page freshness dates', async () => {
        const terms = await listSeoTerms();
        const kycTerm = terms.find((term) => term.slug === 'kyc');
        const standardTerm = terms.find((term) => (
            term.index_priority !== 'high'
            && !searchIntentMetadataOverrides[term.slug]
            && term.source_refs.length > 0
        ));
        const uniqueUpdatedAtValues = new Set(terms.map((term) => term.updated_at));

        expect(uniqueUpdatedAtValues.size).toBeGreaterThan(1);
        expect(kycTerm?.reviewed_at).toBe('2026-05-04T00:00:00.000Z');
        expect(kycTerm?.updated_at).toBe('2026-05-04T00:00:00.000Z');
        expect(standardTerm?.reviewed_at).toBe('2026-03-15T00:00:00.000Z');
        expect(standardTerm?.updated_at).toBe('2026-03-15T00:00:00.000Z');
    });

    it('keeps generated related-term links distributed across the catalog', async () => {
        const terms = await listSeoTerms();
        const incomingCounts = new Map<string, number>(terms.map((term) => [term.id, 0]));

        for (const term of terms) {
            for (const relatedTermId of term.related_term_ids) {
                incomingCounts.set(relatedTermId, (incomingCounts.get(relatedTermId) ?? 0) + 1);
            }
        }

        const values = Array.from(incomingCounts.values()).sort((left, right) => left - right);
        const maxIncomingCount = values[values.length - 1] ?? 0;
        const orphanCount = values.filter((value) => value === 0).length;

        expect(maxIncomingCount).toBeLessThanOrEqual(80);
        expect(orphanCount).toBeLessThanOrEqual(80);
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
