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
    toggleFavoriteInSupabase,
    saveQuizAttemptToSupabase,
    getAllTermSRSFromSupabase,
    fetchTermsFromSupabase,
} from '@/lib/supabaseStorage';
import { createIdempotencyKey } from '@/lib/idempotency';

interface FavoriteToggleResult {
    success: boolean;
    limitReached: boolean;
    isFavorite?: boolean;
    error?: string;
}

interface SRSContextType {
    terms: Term[];
    userProgress: UserProgress;
    dueTerms: Term[];
    toggleFavorite: (termId: string) => Promise<FavoriteToggleResult>;
    isFavorite: (termId: string) => boolean;
    isFavoriteUpdating: (termId: string) => boolean;
    submitQuizAnswer: (termId: string, isCorrect: boolean, responseTimeMs?: number) => Promise<void>;
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
    const [isSyncing, setIsSyncing] = useState(false);
    const [favoriteOptimisticState, setFavoriteOptimisticState] = useState<Record<string, boolean>>({});
    const [favoritePendingState, setFavoritePendingState] = useState<Record<string, boolean>>({});

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

        // Authenticated streak state must come from the server, not from local heuristics.
        const localProgress = getLocalUserProgress();
        const optimisticProgress = isAuthenticated
            ? {
                ...localProgress,
                current_streak: 0,
                last_study_date: null,
            }
            : localProgress;
        setUserProgress(optimisticProgress);

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
                    // Persist cloud truth to localStorage so the next optimistic load
                    // on THIS device starts with the correct favorites (cross-device sync).
                    saveLocalUserProgress(cloudProgress);
                } else {
                    setTerms(currentTerms);
                    setUserProgress(optimisticProgress);
                }
            } catch (error) {
                console.error('Failed to load user data from cloud:', error);
                setTerms(currentTerms);
                setUserProgress(optimisticProgress);
            }
        } else {
            // Guest mode
            // setTerms(currentTerms); (already set above)
            setUserProgress(optimisticProgress);
        }

        setIsSyncing(false);
    }, [isAuthenticated, user]);

    // Load data on mount and when auth state changes
    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        setFavoriteOptimisticState({});
        setFavoritePendingState({});
    }, [isAuthenticated, user?.id]);

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
    const toggleFavorite = useCallback(async (termId: string): Promise<FavoriteToggleResult> => {
        const currentFavorites = userProgress?.favorites ?? [];
        const optimisticFavorite = favoriteOptimisticState[termId];
        const isCurrentlyFavorite = optimisticFavorite ?? currentFavorites.includes(termId);
        const shouldFavorite = !isCurrentlyFavorite;

        try {
            if (favoritePendingState[termId]) {
                return {
                    success: false,
                    limitReached: false,
                    isFavorite: isCurrentlyFavorite,
                };
            }

            // If trying to add and limit reached
            if (!isCurrentlyFavorite && !isAuthenticated && currentFavorites.length >= favoriteLimit) {
                return { success: false, limitReached: true };
            }

            if (isAuthenticated && user) {
                setFavoritePendingState(prev => ({ ...prev, [termId]: true }));
                setFavoriteOptimisticState(prev => ({ ...prev, [termId]: shouldFavorite }));

                try {
                    const response = await toggleFavoriteInSupabase(user.id, termId, shouldFavorite);
                    setUserProgress(prev => {
                        const baseProgress = prev ?? getLocalUserProgress();
                        const reconciled = {
                            ...baseProgress,
                            favorites: response.favorites,
                            updated_at: new Date().toISOString(),
                        };

                        saveLocalUserProgress(reconciled);
                        return reconciled;
                    });

                    return {
                        success: true,
                        limitReached: false,
                        isFavorite: response.isFavorite,
                    };
                } catch (error) {
                    console.error('Failed to sync favorite to cloud:', error);

                    return {
                        success: false,
                        limitReached: false,
                        isFavorite: isCurrentlyFavorite,
                        error: error instanceof Error ? error.message : 'Failed to update favorite.',
                    };
                } finally {
                    setFavoritePendingState(prev => {
                        const next = { ...prev };
                        delete next[termId];
                        return next;
                    });
                    setFavoriteOptimisticState(prev => {
                        const next = { ...prev };
                        delete next[termId];
                        return next;
                    });
                }
            }

            // Guest mode — local storage only
            const updated = toggleFavoriteInStorage(termId);
            setUserProgress(updated);
            return {
                success: true,
                limitReached: false,
                isFavorite: updated.favorites.includes(termId),
            };
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
            return {
                success: false,
                limitReached: false,
                isFavorite: isCurrentlyFavorite,
                error: error instanceof Error ? error.message : 'Failed to update favorite.',
            };
        }
    }, [favoriteLimit, favoriteOptimisticState, favoritePendingState, isAuthenticated, user, userProgress]);

    /**
     * Check if a term is favorited
     */
    const isFavorite = useCallback((termId: string): boolean => {
        if (Object.prototype.hasOwnProperty.call(favoriteOptimisticState, termId)) {
            return favoriteOptimisticState[termId] ?? false;
        }

        return userProgress?.favorites.includes(termId) ?? false;
    }, [favoriteOptimisticState, userProgress]);

    const isFavoriteUpdating = useCallback((termId: string): boolean => (
        favoritePendingState[termId] ?? false
    ), [favoritePendingState]);

    /**
     * Submit a quiz answer and update SRS data
     */
    const submitQuizAnswer = useCallback(async (termId: string, isCorrect: boolean, responseTimeMs: number = 0): Promise<void> => {
        const term = terms.find(t => t.id === termId);
        if (!term) return;

        // Update term with new SRS values
        const updatedTerm = updateTermAfterReview(term, isCorrect);
        const updatedTerms = updateTermInStorage(updatedTerm);
        setTerms(updatedTerms);

        // Record the quiz attempt
        const attempt: QuizAttempt = {
            id: createIdempotencyKey(),
            term_id: termId,
            is_correct: isCorrect,
            response_time_ms: responseTimeMs,
            timestamp: new Date().toISOString(),
            quiz_type: 'daily',
        };
        const baseProgress = userProgress ?? getLocalUserProgress();

        if (isAuthenticated && user) {
            const optimisticProgress = {
                ...baseProgress,
                quiz_history: [...baseProgress.quiz_history, attempt],
                updated_at: new Date().toISOString(),
            };
            setUserProgress(optimisticProgress);
            saveLocalUserProgress(optimisticProgress);
        } else {
            const updatedProgress = addQuizAttemptToStorage(attempt);
            setUserProgress(updatedProgress);
        }

        // Sync to Supabase if authenticated
        if (isAuthenticated && user) {
            try {
                const result = await saveQuizAttemptToSupabase(user.id, attempt);
                const { term_id: _termId, ...serverTermSrs } = result.termSrs;

                setTerms(prev => {
                    const reconciledTerms = prev.map(existingTerm => (
                        existingTerm.id === termId
                            ? { ...existingTerm, ...serverTermSrs }
                            : existingTerm
                    ));

                    saveTerms(reconciledTerms);
                    return reconciledTerms;
                });

                setUserProgress(prev => {
                    if (!prev) {
                        return prev;
                    }

                    const reconciledProgress = {
                        ...prev,
                        quiz_history: prev.quiz_history.some((existingAttempt) => existingAttempt.id === attempt.id)
                            ? prev.quiz_history
                            : [...prev.quiz_history, attempt],
                        current_streak: result.userProgress.current_streak,
                        last_study_date: result.userProgress.last_study_date,
                        total_words_learned: result.userProgress.total_words_learned,
                        updated_at: result.userProgress.updated_at,
                    };

                    saveLocalUserProgress(reconciledProgress);
                    return reconciledProgress;
                });
            } catch (error) {
                console.error('Failed to sync quiz answer to cloud:', error);
                loadData();
            }
        }
    }, [terms, userProgress, isAuthenticated, user, loadData]);

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
        current_language: 'ru' as const,
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
                isFavoriteUpdating,
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
