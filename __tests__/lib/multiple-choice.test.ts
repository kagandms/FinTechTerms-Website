import { buildMultipleChoiceQuestion } from '@/lib/quiz/multiple-choice';
import type { Term } from '@/types';

const createTerm = (
    id: string,
    category: Term['category'],
    overrides: Partial<Term> = {}
): Term => ({
    id,
    slug: id,
    term_en: `Term ${id}`,
    term_ru: `Терм ${id}`,
    term_tr: `Terim ${id}`,
    phonetic_en: '',
    phonetic_ru: '',
    phonetic_tr: '',
    category,
    definition_en: `Definition ${id}`,
    definition_ru: `Определение ${id}`,
    definition_tr: `Tanım ${id}`,
    example_sentence_en: `Example ${id}`,
    example_sentence_ru: `Пример ${id}`,
    example_sentence_tr: `Örnek ${id}`,
    short_definition: { en: `Short ${id}`, ru: `Коротко ${id}`, tr: `Kısa ${id}` },
    expanded_definition: { en: `Expanded ${id}`, ru: `Расширено ${id}`, tr: `Geniş ${id}` },
    why_it_matters: { en: `Why ${id}`, ru: `Почему ${id}`, tr: `Neden ${id}` },
    how_it_works: { en: `How ${id}`, ru: `Как ${id}`, tr: `Nasıl ${id}` },
    risks_and_pitfalls: { en: `Risk ${id}`, ru: `Риск ${id}`, tr: `Risk ${id}` },
    regional_notes: { en: `Region ${id}`, ru: `Регион ${id}`, tr: `Bölge ${id}` },
    seo_title: { en: `SEO ${id}`, ru: `SEO ${id}`, tr: `SEO ${id}` },
    seo_description: { en: `SEO desc ${id}`, ru: `SEO desc ${id}`, tr: `SEO desc ${id}` },
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
    author_id: 'author-1',
    reviewer_id: 'reviewer-1',
    reviewed_at: '2026-03-11T00:00:00.000Z',
    updated_at: '2026-03-11T00:00:00.000Z',
    index_priority: 'standard',
    srs_level: 1,
    next_review_date: '2026-03-11T00:00:00.000Z',
    last_reviewed: null,
    difficulty_score: 2,
    retention_rate: 0.2,
    times_reviewed: 0,
    times_correct: 0,
    ...overrides,
});

describe('buildMultipleChoiceQuestion', () => {
    it('returns 4 unique options with exactly one correct answer', () => {
        const currentTerm = createTerm('term-1', 'Finance');
        const pool = [
            currentTerm,
            createTerm('term-2', 'Finance'),
            createTerm('term-3', 'Finance'),
            createTerm('term-4', 'Technology'),
            createTerm('term-5', 'Fintech'),
        ];

        const question = buildMultipleChoiceQuestion(currentTerm, pool, pool, 'en');

        expect(question).not.toBeNull();
        expect(question?.options).toHaveLength(4);
        expect(question?.options.filter((option) => option.isCorrect)).toHaveLength(1);
        expect(new Set(question?.options.map((option) => option.termId)).size).toBe(4);
        expect(new Set(question?.options.map((option) => option.label)).size).toBe(4);
        expect(question?.correctOptionTermId).toBe('term-1');
    });

    it('uses fallback catalog terms when the active pool does not provide enough distractors', () => {
        const currentTerm = createTerm('term-1', 'Finance');
        const activePool = [currentTerm, createTerm('term-2', 'Finance')];
        const fallbackCatalog = [
            ...activePool,
            createTerm('term-3', 'Technology'),
            createTerm('term-4', 'Fintech'),
            createTerm('term-5', 'Technology'),
        ];

        const question = buildMultipleChoiceQuestion(currentTerm, activePool, fallbackCatalog, 'tr');

        expect(question).not.toBeNull();
        expect(question?.options).toHaveLength(4);
        expect(question?.options.some((option) => option.termId === 'term-4')).toBe(true);
    });
});
