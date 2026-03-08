import { z } from 'zod';

import { UserProgress } from '@/types';

export const quizAttemptSchema = z.object({
    id: z.string().min(1),
    term_id: z.string().min(1),
    is_correct: z.boolean(),
    response_time_ms: z.number().finite().nonnegative(),
    timestamp: z.string().min(1),
    quiz_type: z.enum(['daily', 'practice', 'review']),
}).strict();

export const userProgressSchema = z.object({
    user_id: z.string().min(1),
    favorites: z.array(z.string().min(1)),
    current_language: z.enum(['tr', 'en', 'ru']),
    quiz_history: z.array(quizAttemptSchema),
    total_words_learned: z.number().finite().nonnegative(),
    current_streak: z.number().int().nonnegative(),
    last_study_date: z.string().min(1).nullable(),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
}).strict();

export const isUserProgress = (value: unknown): value is UserProgress => (
    userProgressSchema.safeParse(value).success
);
