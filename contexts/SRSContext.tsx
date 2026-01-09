'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Term, UserProgress, QuizAttempt } from '@/types';
import {
    getTerms,
    updateTerm as updateTermInStorage,
    getUserProgress,
    toggleFavorite as toggleFavoriteInStorage,
    addQuizAttempt as addQuizAttemptToStorage,
} from '@/utils/storage';
import {
    getTermsDueForReview,
    updateTermAfterReview,
    calculateProgressStats
} from '@/utils/srsLogic';
import { useAuth } from '@/contexts/AuthContext';

interface SRSContextType {
    terms: Term[];
    userProgress: UserProgress;
    dueTerms: Term[];
    toggleFavorite: (termId: string) => { success: boolean; limitReached: boolean };
    isFavorite: (termId: string) => boolean;
    submitQuizAnswer: (termId: string, isCorrect: boolean) => void;
    refreshData: () => void;
    canAddMoreFavorites: boolean;
    favoritesRemaining: number;
    stats: {
        totalFavorites: number;
        mastered: number;
        learning: number;
        dueToday: number;
        averageRetention: number;
    };
}

const SRSContext = createContext<SRSContextType | undefined>(undefined);

interface SRSProviderProps {
    children: ReactNode;
}

export function SRSProvider({ children }: SRSProviderProps) {
    const { favoriteLimit, isAuthenticated } = useAuth();
    const [terms, setTerms] = useState<Term[]>([]);
    const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    // Load data on mount
    useEffect(() => {
        const loadedTerms = getTerms();
        const loadedProgress = getUserProgress();
        setTerms(loadedTerms);
        setUserProgress(loadedProgress);
        setIsHydrated(true);
    }, []);

    // Calculate due terms
    const dueTerms = userProgress
        ? getTermsDueForReview(terms, userProgress.favorites)
        : [];

    // Calculate stats
    const stats = userProgress
        ? calculateProgressStats(terms, userProgress.favorites)
        : { totalFavorites: 0, mastered: 0, learning: 0, dueToday: 0, averageRetention: 0 };

    // Check if user can add more favorites
    const canAddMoreFavorites = isAuthenticated || (userProgress?.favorites.length ?? 0) < favoriteLimit;
    const favoritesRemaining = isAuthenticated
        ? Infinity
        : Math.max(0, favoriteLimit - (userProgress?.favorites.length ?? 0));

    /**
     * Toggle a term's favorite status with limit check
     */
    const toggleFavorite = useCallback((termId: string): { success: boolean; limitReached: boolean } => {
        const currentFavorites = userProgress?.favorites ?? [];
        const isCurrentlyFavorite = currentFavorites.includes(termId);

        // If trying to add and limit reached
        if (!isCurrentlyFavorite && !isAuthenticated && currentFavorites.length >= favoriteLimit) {
            return { success: false, limitReached: true };
        }

        const updated = toggleFavoriteInStorage(termId);
        setUserProgress(updated);
        return { success: true, limitReached: false };
    }, [userProgress, favoriteLimit, isAuthenticated]);

    /**
     * Check if a term is favorited
     */
    const isFavorite = useCallback((termId: string): boolean => {
        return userProgress?.favorites.includes(termId) ?? false;
    }, [userProgress]);

    /**
     * Submit a quiz answer and update SRS data
     */
    const submitQuizAnswer = useCallback((termId: string, isCorrect: boolean) => {
        const term = terms.find(t => t.id === termId);
        if (!term) return;

        // Update term with new SRS values
        const updatedTerm = updateTermAfterReview(term, isCorrect);
        const updatedTerms = updateTermInStorage(updatedTerm);
        setTerms(updatedTerms);

        // Record the quiz attempt
        const attempt: QuizAttempt = {
            id: `attempt_${Date.now()}`,
            term_id: termId,
            is_correct: isCorrect,
            response_time_ms: 0,
            timestamp: new Date().toISOString(),
            quiz_type: 'daily',
        };
        const updatedProgress = addQuizAttemptToStorage(attempt);
        setUserProgress(updatedProgress);
    }, [terms]);

    /**
     * Manually refresh all data from storage
     */
    const refreshData = useCallback(() => {
        setTerms(getTerms());
        setUserProgress(getUserProgress());
    }, []);

    // Use default progress if not yet hydrated
    const safeProgress = userProgress ?? {
        user_id: 'guest',
        favorites: [],
        current_language: 'tr' as const,
        quiz_history: [],
        total_words_learned: 0,
        current_streak: 0,
        last_study_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    return (
        <SRSContext.Provider
            value={{
                terms,
                userProgress: safeProgress,
                dueTerms,
                toggleFavorite,
                isFavorite,
                submitQuizAnswer,
                refreshData,
                canAddMoreFavorites,
                favoritesRemaining,
                stats,
            }}
        >
            {children}
        </SRSContext.Provider>
    );
}

/**
 * Hook to access SRS context
 */
export function useSRS() {
    const context = useContext(SRSContext);
    if (context === undefined) {
        throw new Error('useSRS must be used within an SRSProvider');
    }
    return context;
}
