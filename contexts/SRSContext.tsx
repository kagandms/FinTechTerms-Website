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
            // We need to import mockTerms dynamically or assume getTerms() handles it.
            // Actually getTerms() in utils/storage.ts ALREADY handles the mock fallback.
            // But let's be double sure and check if we need to force reload.
        }


        // CLEANUP: Deduplicate local terms immediately (handle poisoned localStorage)
        const uniqueLocalTerms = new Map<string, Term>();
        currentTerms.forEach(term => {
            // Create a normalized key: lowercase, alpha-numeric only to catch "51% Attack" vs "51% Attack"
            const key = term.term_en.toLowerCase().replace(/[^a-z0-9]/g, '');

            // If we have a duplicate, we usually prefer the one with SRS data or just the first one.
            // But if one is from our "static" file (sequential IDs) and one is random DB ID, it's hard to know.
            // We'll just keep the first one we encounter, but prioritize "term_" IDs if possible? 
            // Actually, simple first-win strategy is safest for now to reduce count.
            if (!uniqueLocalTerms.has(key)) {
                uniqueLocalTerms.set(key, term);
            }
        });

        // Convert back to array
        currentTerms = Array.from(uniqueLocalTerms.values());

        // OPTIMIZATION: Show local data IMMEDIATELY (Stale-While-Revalidate)
        if (currentTerms.length > 0) {
            setTerms(currentTerms);
        }

        // 1. Fetch latest terms content from Supabase (if online)
        try {
            const dbTerms = await fetchTermsFromSupabase();

            if (dbTerms && dbTerms.length > 0) {
                // Merge DB content into local/mock list
                const dbTermsMap = new Map(dbTerms.map(t => [t.id, t]));

                // 1. Update existing terms
                const mergedTerms: Term[] = currentTerms.map(localTerm => {
                    const dbTerm = dbTermsMap.get(localTerm.id);
                    if (dbTerm) {
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
                // 2. Add new terms from DB that weren't in local list
                dbTerms.forEach(dbTerm => {
                    const existingById = currentTerms.find(t => t.id === dbTerm.id);
                    // Also check for duplicate English content to avoid double entries with different IDs
                    const normalizeTitle = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const dbTitleKey = normalizeTitle(dbTerm.term_en || '');

                    const existingByTitle = currentTerms.find(t => normalizeTitle(t.term_en) === dbTitleKey);

                    if (!existingById && !existingByTitle) {
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
                    } else if (!existingById && existingByTitle) {
                        console.warn(`[LoadData] Duplicate term detected (same title, different ID). DB: ${dbTerm.id}, Local: ${existingByTitle.id}. Title: ${dbTerm.term_en || 'Unknown'}`);
                    }
                });

                currentTerms = mergedTerms;
                // Update local storage cache
                saveTerms(currentTerms);
                // Update state with fresh data
                setTerms(currentTerms);
            }
        } catch (error) {
            console.warn('[LoadData] Could not fetch terms from Supabase, using local.', error);
        }

        // Final safety check: if we somehow definitely have 0 terms, force reload from utils
        if (!currentTerms || currentTerms.length === 0) {
            console.warn('[LoadData] Terms are still empty. FORCING mock data reload.');
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
