import { z } from 'zod';

// Zod Schema mirroring the Term interface
export const TermSchema = z.object({
    id: z.string().default('unknown'),
    term_en: z.string().default('Unknown'),
    term_ru: z.string().default(''),
    term_tr: z.string().default(''),
    phonetic_en: z.string().optional(),
    phonetic_ru: z.string().optional(),
    phonetic_tr: z.string().optional(),

    category: z.enum(['Fintech', 'Finance', 'Technology']).default('Finance'),

    definition_en: z.string().default('No definition available'),
    definition_ru: z.string().default(''),
    definition_tr: z.string().default(''),

    example_sentence_en: z.string().default(''),
    example_sentence_ru: z.string().default(''),
    example_sentence_tr: z.string().default(''),

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

