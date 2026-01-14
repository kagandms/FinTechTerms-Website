'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Term, UserProgress, QuizAttempt } from '@/types';
import {
    getTerms,
    saveTerms,
    updateTerm as updateTermInStorage,
    getUserProgress as getLocalUserProgress,
    toggleFavorite as toggleFavoriteInStorage,
    addQuizAttempt as addQuizAttemptToStorage,
    saveUserProgress as saveLocalUserProgress,
} from '@/utils/storage';
import {
    getTermsDueForReview,
    updateTermAfterReview,
    calculateProgressStats
} from '@/utils/srsLogic';
import { useAuth } from '@/contexts/AuthContext';
import {
    getUserProgressFromSupabase,
    saveUserProgressToSupabase,
    toggleFavoriteInSupabase,
    saveQuizAttemptToSupabase,
    saveTermSRSToSupabase,
    getAllTermSRSFromSupabase,
    updateStreakInSupabase,
    fetchTermsFromSupabase,
} from '@/lib/supabaseStorage';

interface SRSContextType {
    terms: Term[];
    userProgress: UserProgress;
    dueTerms: Term[];
    toggleFavorite: (termId: string) => { success: boolean; limitReached: boolean };
    isFavorite: (termId: string) => boolean;
    submitQuizAnswer: (termId: string, isCorrect: boolean, responseTimeMs?: number) => void;
    refreshData: () => void;
    canAddMoreFavorites: boolean;
    favoritesRemaining: number;
    isSyncing: boolean;
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
    const { favoriteLimit, isAuthenticated, user } = useAuth();
    const [terms, setTerms] = useState<Term[]>([]);
    const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    /**
     * Load data from appropriate source
     */
    const loadData = useCallback(async () => {
        setIsSyncing(true);
        // Default to local storage or mock data initially
        let currentTerms = getTerms();

        // If local storage returned empty (shouldn't happen due to getTerms logic, but safety first), use mockTerms
        if (!currentTerms || currentTerms.length === 0) {
            console.log('[LoadData] Local terms empty, using mockTerms directly');
            // We need to import mockTerms dynamically or assume getTerms() handles it.
            // Actually getTerms() in utils/storage.ts ALREADY handles the mock fallback.
            // But let's be double sure and check if we need to force reload.
        }

        console.log('[LoadData] Initial terms from local/mock:', currentTerms.length);

        // 1. Fetch latest terms content from Supabase (if online)
        try {
            console.log('[LoadData] Fetching from Supabase...');
            const dbTerms = await fetchTermsFromSupabase();
            console.log('[LoadData] Supabase response count:', dbTerms?.length);

            if (dbTerms && dbTerms.length > 0) {
                // Merge DB content into local/mock list
                // We want to KEEP all mock terms, but update them with DB data if it exists.
                // We also want to ADD completely new terms from DB.

                const dbTermsMap = new Map(dbTerms.map(t => [t.id, t]));

                // 1. Update existing terms
                const mergedTerms: Term[] = currentTerms.map(localTerm => {
                    const dbTerm = dbTermsMap.get(localTerm.id);
                    if (dbTerm) {
                        // DB has this term, use DB content but keep local SRS stats
                        return {
                            ...dbTerm,
                            srs_level: localTerm.srs_level,
                            next_review_date: localTerm.next_review_date,
                            last_reviewed: localTerm.last_reviewed,
                            difficulty_score: localTerm.difficulty_score,
                            retention_rate: localTerm.retention_rate,
                            times_reviewed: localTerm.times_reviewed,
                            times_correct: localTerm.times_correct,
                        } as Term;
                    }
                    return localTerm;
                });

                // 2. Add new terms from DB that weren't in local list
                dbTerms.forEach(dbTerm => {
                    if (!currentTerms.find(t => t.id === dbTerm.id)) {
                        mergedTerms.push({
                            ...dbTerm,
                            srs_level: 1, // Default for new
                            next_review_date: new Date().toISOString(),
                            last_reviewed: null,
                            difficulty_score: 2.5,
                            retention_rate: 0,
                            times_reviewed: 0,
                            times_correct: 0
                        } as Term);
                    }
                });

                currentTerms = mergedTerms;
                console.log('[LoadData] Merged terms count:', currentTerms.length);
                // Update local storage cache
                saveTerms(currentTerms);
            } else {
                console.warn('[LoadData] Supabase returned empty terms array. Keeping local data.');
                // If local data is also somehow empty (rare), we must ensure we have something
                if (currentTerms.length === 0) {
                    // getTerms() handles this, but let's re-verify
                    console.warn('[LoadData] CRITICAL: No terms found. Resetting to defaults.');
                    // We can rely on the fact getTerms returns mockTerms if storage empty
                }
            }
        } catch (error) {
            console.warn('[LoadData] Could not fetch terms from Supabase, using local.', error);
            // Fallback to currentTerms (which is getTerms() result)
        }

        // Final safety check: if we somehow definitely have 0 terms, force reload from utils
        if (currentTerms.length === 0) {
            const { mockTerms } = await import('@/data/mockData');
            currentTerms = mockTerms;
            saveTerms(currentTerms);
        }

        setTerms(currentTerms);

        if (isAuthenticated && user) {
            // ... (rest of auth logic matches existing)
            try {
                const cloudProgress = await getUserProgressFromSupabase(user.id);

                if (cloudProgress) {
                    const srsData = await getAllTermSRSFromSupabase(user.id);
                    const mergedTerms = currentTerms.map(term => {
                        const override = srsData.get(term.id);
                        if (override) {
                            return { ...term, ...override };
                        }
                        return term;
                    });

                    setTerms(mergedTerms);
                    setUserProgress(cloudProgress);
                } else {
                    setTerms(currentTerms);
                    setUserProgress(getLocalUserProgress());
                }
            } catch (error) {
                console.error('Failed to load user data from cloud:', error);
                setTerms(currentTerms);
                setUserProgress(getLocalUserProgress());
            }
        } else {
            // Guest mode
            setTerms(currentTerms);
            setUserProgress(getLocalUserProgress());
        }

        setIsSyncing(false);
        setIsHydrated(true);
    }, [isAuthenticated, user]);

    // Load data on mount and when auth state changes
    useEffect(() => {
        loadData();
    }, [loadData]);

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

        if (isAuthenticated && user) {
            // Sync to Supabase
            toggleFavoriteInSupabase(user.id, termId, currentFavorites)
                .then(newFavorites => {
                    setUserProgress(prev => prev ? { ...prev, favorites: newFavorites } : prev);
                })
                .catch(error => {
                    console.error('Failed to sync favorite to cloud:', error);
                });
        }

        // Always update local state immediately for responsiveness
        const updated = toggleFavoriteInStorage(termId);
        setUserProgress(updated);
        return { success: true, limitReached: false };
    }, [userProgress, favoriteLimit, isAuthenticated, user]);

    /**
     * Check if a term is favorited
     */
    const isFavorite = useCallback((termId: string): boolean => {
        return userProgress?.favorites.includes(termId) ?? false;
    }, [userProgress]);

    /**
     * Submit a quiz answer and update SRS data
     */
    const submitQuizAnswer = useCallback(async (termId: string, isCorrect: boolean, responseTimeMs: number = 0) => {
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
            response_time_ms: responseTimeMs,
            timestamp: new Date().toISOString(),
            quiz_type: 'daily',
        };
        const updatedProgress = addQuizAttemptToStorage(attempt);
        setUserProgress(updatedProgress);

        // Sync to Supabase if authenticated
        if (isAuthenticated && user) {
            try {
                await saveQuizAttemptToSupabase(user.id, attempt);
                await saveTermSRSToSupabase(user.id, termId, {
                    srs_level: updatedTerm.srs_level,
                    next_review_date: updatedTerm.next_review_date,
                    last_reviewed: updatedTerm.last_reviewed,
                    difficulty_score: updatedTerm.difficulty_score,
                    retention_rate: updatedTerm.retention_rate,
                    times_reviewed: updatedTerm.times_reviewed,
                    times_correct: updatedTerm.times_correct,
                });
                await updateStreakInSupabase(user.id);

                // Sync progress
                await saveUserProgressToSupabase(user.id, {
                    favorites: updatedProgress.favorites,
                    current_streak: updatedProgress.current_streak,
                    last_study_date: updatedProgress.last_study_date,
                    total_words_learned: updatedProgress.total_words_learned,
                });
            } catch (error) {
                console.error('Failed to sync quiz answer to cloud:', error);
            }
        }
    }, [terms, isAuthenticated, user]);

    /**
     * Manually refresh all data from storage
     */
    const refreshData = useCallback(() => {
        loadData();
    }, [loadData]);

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
                isSyncing,
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
