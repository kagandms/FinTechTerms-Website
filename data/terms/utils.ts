
import { Term, TermContextTags } from '../../types';

const defaultContextTagsByCategory: Record<Term['category'], TermContextTags> = {
    Fintech: {
        disciplines: ['economics', 'mis'],
        contest_tracks: ['economics'],
        target_universities: ['SPbU', 'HSE'],
        contest_profile: 'comparative-economics-mis',
    },
    Finance: {
        disciplines: ['economics'],
        contest_tracks: ['economics'],
        target_universities: ['SPbU', 'HSE'],
        contest_profile: 'russian-economics',
    },
    Technology: {
        disciplines: ['mis'],
        contest_tracks: ['mis'],
        target_universities: ['SPbU', 'HSE'],
        contest_profile: 'russian-mis',
    },
};

const cloneContextTags = (category: Term['category']): TermContextTags => {
    const template = defaultContextTagsByCategory[category];
    const cloned: TermContextTags = {};

    for (const [key, value] of Object.entries(template)) {
        cloned[key] = Array.isArray(value) ? [...value] as typeof value : value;
    }

    return cloned;
};

export const createTerm = (
    id: string,
    en: string, ru: string, tr: string,
    category: Term['category'],
    defEn: string, defRu: string, defTr: string,
    exEn: string, exRu: string, exTr: string,
    phonEn?: string, phonRu?: string, phonTr?: string,
    difficulty: number = 2.5,
    taxonomyOverrides?: Partial<Pick<Term, 'context_tags' | 'regional_market'>>
): Term => ({
    id,
    term_en: en,
    term_ru: ru,
    term_tr: tr,
    phonetic_en: phonEn,
    phonetic_ru: phonRu,
    phonetic_tr: phonTr,
    category,
    definition_en: defEn,
    definition_ru: defRu,
    definition_tr: defTr,
    example_sentence_en: exEn,
    example_sentence_ru: exRu,
    example_sentence_tr: exTr,
    context_tags: {
        ...cloneContextTags(category),
        ...(taxonomyOverrides?.context_tags ?? {}),
    },
    regional_market: taxonomyOverrides?.regional_market ?? 'GLOBAL',
    srs_level: 1,
    next_review_date: new Date().toISOString(),
    last_reviewed: null,
    difficulty_score: difficulty,
    retention_rate: 0,
    times_reviewed: 0,
    times_correct: 0,
});
