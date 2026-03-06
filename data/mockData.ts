
import { Term } from '../types';
import { terms } from './terms';
import { createTerm } from './terms/utils';

export const mockTerms: Term[] = terms;

/**
 * Default user progress state
 */
export const defaultUserProgress: import('@/types').UserProgress = {
    user_id: 'guest_user',
    favorites: [],
    current_language: 'ru',
    quiz_history: [],
    total_words_learned: 0,
    current_streak: 0,
    last_study_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

// Re-export createTerm for any other legacy usage
export { createTerm };
