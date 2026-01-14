
import { Term } from '../../types';

export const createTerm = (
    id: string,
    en: string, ru: string, tr: string,
    category: Term['category'],
    defEn: string, defRu: string, defTr: string,
    exEn: string, exRu: string, exTr: string,
    phonEn?: string, phonRu?: string, phonTr?: string,
    difficulty: number = 2.5
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
    srs_level: 1,
    next_review_date: new Date().toISOString(),
    last_reviewed: null,
    difficulty_score: difficulty,
    retention_rate: 0,
    times_reviewed: 0,
    times_correct: 0,
});
