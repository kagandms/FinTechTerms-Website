/**
 * @jest-environment node
 */

import {
    EDITORIAL_AUTHORITY_LANGUAGES,
    editorialAuthorityOverrides,
    editorialAuthorityPilotSlugs,
    getEditorialAuthorityOverride,
} from '@/data/seo/editorial-authority';
import { seoSources } from '@/data/seo/sources';
import { listSeoTerms } from '@/lib/public-seo-catalog';

const contentFields = [
    'expanded_definition',
    'why_it_matters',
    'how_it_works',
    'risks_and_pitfalls',
    'regional_notes',
    'seo_title',
    'seo_description',
] as const;

describe('editorial authority overrides', () => {
    it('keeps a complete 20-term authority batch with source quorum', () => {
        const uniquePilotSlugs = new Set(editorialAuthorityPilotSlugs);
        const sourceIdSet = new Set(seoSources.map((source) => source.id));

        expect(editorialAuthorityPilotSlugs).toHaveLength(20);
        expect(uniquePilotSlugs.size).toBe(editorialAuthorityPilotSlugs.length);

        for (const slug of editorialAuthorityPilotSlugs) {
            const override = editorialAuthorityOverrides[slug];
            const sources = override.sourceIds
                .map((sourceId) => seoSources.find((source) => source.id === sourceId))
                .filter((source): source is (typeof seoSources)[number] => Boolean(source));

            expect(override.sourceIds.length).toBeGreaterThanOrEqual(3);
            expect(override.sourceIds.every((sourceId) => sourceIdSet.has(sourceId))).toBe(true);
            expect(sources.some((source) => source.type !== 'glossary')).toBe(true);
        }
    });

    it('requires localized authority fields for every pilot term', () => {
        for (const slug of editorialAuthorityPilotSlugs) {
            const override = editorialAuthorityOverrides[slug];

            for (const language of EDITORIAL_AUTHORITY_LANGUAGES) {
                expect(override.searchIntent[language].trim().length).toBeGreaterThan(0);
                expect(override.authorityRationale[language].trim().length).toBeGreaterThan(0);

                for (const field of contentFields) {
                    expect(override.content[field][language].trim().length).toBeGreaterThan(0);
                }
            }
        }
    });

    it('returns explicit overrides without leaking fallback objects', () => {
        expect(getEditorialAuthorityOverride('tokenization')).toBe(editorialAuthorityOverrides.tokenization);
        expect(getEditorialAuthorityOverride('missing-term')).toBeNull();
    });

    it('applies pilot authority content in the public SEO catalog', async () => {
        const terms = await listSeoTerms();
        const tokenization = terms.find((term) => term.slug === 'tokenization');
        const authorization = terms.find((term) => term.slug === 'authorization');

        expect(tokenization?.expanded_definition.en).toBe(
            editorialAuthorityOverrides.tokenization.content.expanded_definition.en
        );
        expect(tokenization?.source_refs).toEqual(editorialAuthorityOverrides.tokenization.sourceIds);
        expect(authorization?.related_term_ids.length).toBeGreaterThanOrEqual(3);
        expect(authorization?.comparison_term_id).toBeDefined();
        expect(authorization?.prerequisite_term_id).toBeDefined();
    });
});
