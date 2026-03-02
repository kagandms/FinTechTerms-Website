import { z } from 'zod';

// Zod Schema mirroring the Term interface
export const TermSchema = z.object({
    id: z.string().catch('unknown'),
    term_en: z.string().catch('Unknown'),
    term_ru: z.string().nullable().catch('').transform(s => s || ''),
    term_tr: z.string().nullable().catch('').transform(s => s || ''),
    phonetic_en: z.string().nullish().catch(''),
    phonetic_ru: z.string().nullish().catch(''),
    phonetic_tr: z.string().nullish().catch(''),

    category: z.enum(['Fintech', 'Finance', 'Technology']).default('Finance'),

    definition_en: z.string().nullable().catch('No definition available').transform(s => s || 'No definition available'),
    definition_ru: z.string().nullable().catch('').transform(s => s || ''),
    definition_tr: z.string().nullable().catch('').transform(s => s || ''),

    example_sentence_en: z.string().nullable().catch('').transform(s => s || ''),
    example_sentence_ru: z.string().nullable().catch('').transform(s => s || ''),
    example_sentence_tr: z.string().nullable().catch('').transform(s => s || ''),

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
    response_time_ms: z.number().int().positive(),
    quiz_type: z.enum(['daily', 'practice', 'review', 'simulation']).default('simulation'),
    anonymous_id: z.string().optional(),
    user_id: z.string().optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
});

