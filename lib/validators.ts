import { z } from 'zod';
import { QUIZ_TYPE_VALUES } from '@/types';

const ContextTagValueSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
    z.array(z.boolean()),
]);

const ContextTagsSchema = z
    .record(ContextTagValueSchema)
    .catch({})
    .transform((value) => value ?? {});

const LocalizedTextSchema = z.object({
    en: z.string().default(''),
    ru: z.string().default(''),
    tr: z.string().default(''),
});

// Zod Schema mirroring the Term interface
export const TermSchema = z.object({
    id: z.string().catch('unknown'),
    slug: z.string().catch('unknown'),
    term_en: z.string().catch('Unknown'),
    term_ru: z.string().nullable().catch('').transform(s => s || ''),
    term_tr: z.string().nullable().catch('').transform(s => s || ''),
    phonetic_en: z.string().nullable().catch(null).transform(s => s ?? undefined),
    phonetic_ru: z.string().nullable().catch(null).transform(s => s ?? undefined),
    phonetic_tr: z.string().nullable().catch(null).transform(s => s ?? undefined),

    category: z.enum(['Fintech', 'Finance', 'Technology']).default('Finance'),

    definition_en: z.string().nullable().catch('No definition available').transform(s => s || 'No definition available'),
    definition_ru: z.string().nullable().catch('').transform(s => s || ''),
    definition_tr: z.string().nullable().catch('').transform(s => s || ''),

    example_sentence_en: z.string().nullable().catch('').transform(s => s || ''),
    example_sentence_ru: z.string().nullable().catch('').transform(s => s || ''),
    example_sentence_tr: z.string().nullable().catch('').transform(s => s || ''),

    short_definition: LocalizedTextSchema.default({ en: '', ru: '', tr: '' }),
    expanded_definition: LocalizedTextSchema.default({ en: '', ru: '', tr: '' }),
    why_it_matters: LocalizedTextSchema.default({ en: '', ru: '', tr: '' }),
    how_it_works: LocalizedTextSchema.default({ en: '', ru: '', tr: '' }),
    risks_and_pitfalls: LocalizedTextSchema.default({ en: '', ru: '', tr: '' }),
    regional_notes: LocalizedTextSchema.default({ en: '', ru: '', tr: '' }),
    seo_title: LocalizedTextSchema.default({ en: '', ru: '', tr: '' }),
    seo_description: LocalizedTextSchema.default({ en: '', ru: '', tr: '' }),

    context_tags: ContextTagsSchema.default({}),
    regional_markets: z.array(z.enum(['MOEX', 'BIST', 'GLOBAL'])).default(['GLOBAL']),
    primary_market: z.enum(['MOEX', 'BIST', 'GLOBAL']).default('GLOBAL'),
    regional_market: z.enum(['MOEX', 'BIST', 'GLOBAL']).default('GLOBAL'),
    is_academic: z.boolean().default(true),
    difficulty_level: z.enum(['basic', 'intermediate', 'advanced']).default('intermediate'),
    related_term_ids: z.array(z.string()).default([]),
    comparison_term_id: z.string().nullable().default(null),
    prerequisite_term_id: z.string().nullable().default(null),
    topic_ids: z.array(z.string()).default([]),
    source_refs: z.array(z.string()).default([]),
    author_id: z.string().default('kagan-samet-durmus'),
    reviewer_id: z.string().default('fintechterms-editorial-review'),
    reviewed_at: z.string().default(() => new Date().toISOString()),
    updated_at: z.string().default(() => new Date().toISOString()),
    index_priority: z.enum(['high', 'standard', 'supporting']).default('standard'),

    // SRS Data (with safe defaults)
    srs_level: z.number().default(0),
    next_review_date: z.string().default(() => new Date().toISOString()),
    last_reviewed: z.string().nullable().default(null),

    // Analytics
    difficulty_score: z.number().default(0),
    retention_rate: z.number().default(0),
    times_reviewed: z.number().default(0),
    times_correct: z.number().default(0),
});

// For partial updates or creation
export const PartialTermSchema = TermSchema.partial();

// User Schema (Basic validation)
export const UserSchema = z.object({
    email: z.string().email(),
    full_name: z.string().min(2),
});

// Quiz API Request Schema
export const QuizAttemptSchema = z.object({
    term_id: z.string().min(1, 'Term ID is required'),
    is_correct: z.boolean(),
    response_time_ms: z.number().int().nonnegative(),
    quiz_type: z.enum(QUIZ_TYPE_VALUES).default('simulation'),
    anonymous_id: z.string().optional(),
    user_id: z.string().optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
});
