import { filterTermsForSearch } from '@/lib/search-state';
import type { Term } from '@/types';

const createTerm = (overrides: Partial<Term>): Term => ({
    id: 'term-1',
    slug: 'term-1',
    term_en: 'Insurance',
    term_ru: 'Страхование',
    term_tr: 'Isik Sigortasi',
    phonetic_en: '',
    phonetic_ru: '',
    phonetic_tr: '',
    category: 'Finance',
    definition_en: 'Insurance definition',
    definition_ru: 'Страхование',
    definition_tr: 'Isik sigortasi tanimi',
    example_sentence_en: '',
    example_sentence_ru: '',
    example_sentence_tr: '',
    short_definition: { en: '', ru: '', tr: '' },
    expanded_definition: { en: '', ru: '', tr: '' },
    why_it_matters: { en: '', ru: '', tr: '' },
    how_it_works: { en: '', ru: '', tr: '' },
    risks_and_pitfalls: { en: '', ru: '', tr: '' },
    regional_notes: { en: '', ru: '', tr: '' },
    seo_title: { en: '', ru: '', tr: '' },
    seo_description: { en: '', ru: '', tr: '' },
    context_tags: {},
    regional_markets: ['GLOBAL'],
    primary_market: 'GLOBAL',
    regional_market: 'GLOBAL',
    is_academic: true,
    difficulty_level: 'intermediate',
    related_term_ids: [],
    comparison_term_id: null,
    prerequisite_term_id: null,
    topic_ids: [],
    source_refs: [],
    author_id: 'author',
    reviewer_id: 'reviewer',
    reviewed_at: '2026-03-11T00:00:00.000Z',
    updated_at: '2026-03-11T00:00:00.000Z',
    index_priority: 'standard',
    srs_level: 1,
    next_review_date: '2026-03-11T00:00:00.000Z',
    last_reviewed: null,
    difficulty_score: 2.5,
    retention_rate: 0,
    times_reviewed: 0,
    times_correct: 0,
    ...overrides,
});

describe('filterTermsForSearch', () => {
    it('matches Turkish dotted and dotless i variants consistently', () => {
        const terms = [
            createTerm({
                id: 'term-tr',
                term_tr: 'Iletisim',
                definition_tr: 'İletişim altyapısı',
            }),
        ];

        const results = filterTermsForSearch(terms, {
            query: 'iletişim',
            selectedCategory: null,
            selectedMarket: null,
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe('term-tr');
    });
});
