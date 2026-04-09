/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SRSProvider, useSRS } from '@/contexts/SRSContext';
import type { UserProgress } from '@/types';
import { STUDY_SESSION_READY_EVENT } from '@/lib/study-session-storage';

const mockUseAuth = jest.fn();
const mockShowToast = jest.fn();
const mockGetTerms = jest.fn();
const mockSaveTerms = jest.fn();
const mockUpdateTermInStorage = jest.fn();
const mockGetUserProgress = jest.fn();
const mockToggleFavoriteInStorage = jest.fn();
const mockAddQuizAttemptToStorage = jest.fn();
const mockSaveUserProgress = jest.fn();
const mockGetGuestQuizPreview = jest.fn();
const mockRecordGuestQuizPreviewAttempt = jest.fn();
const mockGetMistakeReviewQueue = jest.fn();
const mockRecordMistakeReviewMiss = jest.fn();
const mockRemoveMistakeReviewTerm = jest.fn();
const mockGetTermsDueForReview = jest.fn();
const mockUpdateTermAfterReview = jest.fn();
const mockCalculateProgressStats = jest.fn();
const mockGetUserProgressFromSupabase = jest.fn();
const mockToggleFavoriteInSupabase = jest.fn();
const mockSaveQuizAttemptToSupabase = jest.fn();
const mockGetAllTermSRSFromSupabase = jest.fn();
const mockGetAllTermSRSFromSupabaseUnbounded = jest.fn();
const mockFetchTermsFromSupabase = jest.fn();
const mockCreateIdempotencyKey = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

jest.mock('@/utils/storage', () => ({
    getTerms: () => mockGetTerms(),
    saveTerms: (...args: unknown[]) => mockSaveTerms(...args),
    updateTerm: (...args: unknown[]) => mockUpdateTermInStorage(...args),
    getUserProgress: (...args: unknown[]) => mockGetUserProgress(...args),
    toggleFavorite: (...args: unknown[]) => mockToggleFavoriteInStorage(...args),
    addQuizAttempt: (...args: unknown[]) => mockAddQuizAttemptToStorage(...args),
    saveUserProgress: (...args: unknown[]) => mockSaveUserProgress(...args),
    getGuestQuizPreview: () => mockGetGuestQuizPreview(),
    recordGuestQuizPreviewAttempt: (...args: unknown[]) => mockRecordGuestQuizPreviewAttempt(...args),
    getMistakeReviewQueue: (...args: unknown[]) => mockGetMistakeReviewQueue(...args),
    recordMistakeReviewMiss: (...args: unknown[]) => mockRecordMistakeReviewMiss(...args),
    removeMistakeReviewTerm: (...args: unknown[]) => mockRemoveMistakeReviewTerm(...args),
}));

jest.mock('@/utils/srsLogic', () => ({
    getTermsDueForReview: (...args: unknown[]) => mockGetTermsDueForReview(...args),
    updateTermAfterReview: (...args: unknown[]) => mockUpdateTermAfterReview(...args),
    calculateProgressStats: (...args: unknown[]) => mockCalculateProgressStats(...args),
}));

jest.mock('@/lib/supabaseStorage', () => ({
    getUserProgressFromSupabase: (...args: unknown[]) => mockGetUserProgressFromSupabase(...args),
    toggleFavoriteInSupabase: (...args: unknown[]) => mockToggleFavoriteInSupabase(...args),
    saveQuizAttemptToSupabase: (...args: unknown[]) => mockSaveQuizAttemptToSupabase(...args),
    getAllTermSRSFromSupabase: (...args: unknown[]) => mockGetAllTermSRSFromSupabase(...args),
    getAllTermSRSFromSupabaseUnbounded: (...args: unknown[]) => mockGetAllTermSRSFromSupabaseUnbounded(...args),
    fetchTermsFromSupabase: (...args: unknown[]) => mockFetchTermsFromSupabase(...args),
}));

jest.mock('@/lib/idempotency', () => ({
    createIdempotencyKey: () => mockCreateIdempotencyKey(),
}));

const baseTerm = {
    id: 'term-1',
    term_en: 'Bitcoin',
    term_ru: 'Биткоин',
    term_tr: 'Bitcoin',
    phonetic_en: '',
    phonetic_ru: '',
    phonetic_tr: '',
    category: 'Fintech' as const,
    definition_en: 'Definition',
    definition_ru: 'Определение',
    definition_tr: 'Tanim',
    example_sentence_en: 'Example',
    example_sentence_ru: 'Пример',
    example_sentence_tr: 'Ornek',
    context_tags: {},
    regional_market: 'GLOBAL' as const,
    is_academic: true,
    difficulty_level: 'intermediate' as const,
    srs_level: 1,
    next_review_date: '2026-03-11T00:00:00.000Z',
    last_reviewed: null,
    difficulty_score: 2.5,
    retention_rate: 0.2,
    times_reviewed: 0,
    times_correct: 0,
};

const baseProgress: UserProgress = {
    user_id: 'user-1',
    favorites: ['term-1'],
    current_language: 'ru' as const,
    quiz_history: [],
    total_words_learned: 0,
    current_streak: 0,
    last_study_date: null,
    created_at: '2026-03-11T00:00:00.000Z',
    updated_at: '2026-03-11T00:00:00.000Z',
};

const recordQuizResult = {
    userProgress: {
        current_streak: 1,
        last_study_date: '2026-03-11T12:00:00.000Z',
        total_words_learned: 0,
        updated_at: '2026-03-11T12:00:00.000Z',
    },
    termSrs: {
        term_id: 'term-1',
        srs_level: 2,
        next_review_date: '2099-01-01T00:00:00.000Z',
        last_reviewed: '2026-03-11T12:00:00.000Z',
        difficulty_score: 2.3,
        retention_rate: 0.5,
        times_reviewed: 1,
        times_correct: 1,
    },
};

const pendingReviewQueueKey = (userId = 'user-1') => `pending_review_queue:${userId}`;
const studySessionStorageKey = (tabId = 'tab-1') => `fintechterms_session:${tabId}`;

const okProgressResult = (overrides?: Partial<typeof baseProgress>) => ({
    status: 'ok' as const,
    data: {
        ...baseProgress,
        ...overrides,
    },
});

const computeDueTerms = (terms: typeof baseTerm[], favorites: string[]) => terms.filter((term) => (
    favorites.includes(term.id) && new Date(term.next_review_date).getTime() <= Date.now()
));

function TestConsumer() {
    const { dueTerms, submitQuizAnswer, userProgress, toggleFavorite } = useSRS();
    const [error, setError] = React.useState<string | null>(null);
    const [toggleState, setToggleState] = React.useState<string | null>(null);

    return (
        <div>
            <div data-testid="due-count">{dueTerms.length}</div>
            <div data-testid="current-streak">{userProgress.current_streak}</div>
            <div data-testid="last-study-date">{userProgress.last_study_date ?? 'none'}</div>
            <div data-testid="favorites-count">{userProgress.favorites.length}</div>
            <div data-testid="quiz-history-count">{userProgress.quiz_history.length}</div>
            <button
                type="button"
                onClick={() => {
                    void submitQuizAnswer('term-1', true, 1200, 'review-1').catch((err) => {
                        setError(err instanceof Error ? err.message : String(err));
                    });
                }}
            >
                answer
            </button>
            <button
                type="button"
                onClick={() => {
                    void toggleFavorite('term-1').then((result) => {
                        setToggleState(JSON.stringify(result));
                    });
                }}
            >
                favorite
            </button>
            {error ? <div data-testid="submit-error">{error}</div> : null}
            {toggleState ? <div data-testid="toggle-result">{toggleState}</div> : null}
        </div>
    );
}

describe('SRSContext', () => {
    let authState: {
        entitlements: {
            canUseAiFeatures: boolean;
            canUseAdvancedAnalytics: boolean;
            canUseMistakeReview: boolean;
            canUseReviewMode: boolean;
            canInstallPwa: boolean;
            maxFavorites: number;
            requiresProfileCompletion: boolean;
        };
        favoriteLimit: number;
        isAuthenticated: boolean;
        isLoading: boolean;
        requiresProfileCompletion: boolean;
        user: { id: string } | null;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('fintechterms_session_tab_id', 'tab-1');
        sessionStorage.setItem(studySessionStorageKey(), JSON.stringify({
            id: 'session-1',
            token: 's'.repeat(32),
        }));

        authState = {
            entitlements: {
                canUseAiFeatures: true,
                canUseAdvancedAnalytics: true,
                canUseMistakeReview: true,
                canUseReviewMode: true,
                canInstallPwa: true,
                maxFavorites: Number.POSITIVE_INFINITY,
                requiresProfileCompletion: false,
            },
            favoriteLimit: Number.POSITIVE_INFINITY,
            isAuthenticated: true,
            isLoading: false,
            requiresProfileCompletion: false,
            user: { id: 'user-1' },
        };

        mockUseAuth.mockImplementation(() => authState);
        mockGetTerms.mockReturnValue([baseTerm]);
        mockGetUserProgress.mockReturnValue(baseProgress);
        mockGetMistakeReviewQueue.mockReturnValue([]);
        mockFetchTermsFromSupabase.mockResolvedValue([baseTerm]);
        mockGetUserProgressFromSupabase.mockResolvedValue(okProgressResult());
        mockGetAllTermSRSFromSupabase.mockResolvedValue({ status: 'ok', data: new Map() });
        mockGetAllTermSRSFromSupabaseUnbounded.mockResolvedValue({ status: 'ok', data: new Map() });
        mockCalculateProgressStats.mockImplementation((terms: typeof baseTerm[], favorites: string[]) => ({
            totalFavorites: favorites.length,
            mastered: terms.filter((term) => term.srs_level >= 4).length,
            learning: terms.filter((term) => term.srs_level > 0 && term.srs_level < 4).length,
            dueToday: computeDueTerms(terms, favorites).length,
            averageRetention: 0,
        }));
        mockGetTermsDueForReview.mockImplementation(computeDueTerms);
        mockUpdateTermAfterReview.mockImplementation((term: typeof baseTerm) => ({
            ...term,
            srs_level: 2,
            next_review_date: '2099-01-01T00:00:00.000Z',
        }));
        mockCreateIdempotencyKey.mockReturnValue('review-key-1');
        mockToggleFavoriteInSupabase.mockResolvedValue({
            status: 'ok',
            data: { favorites: ['term-1'], isFavorite: true },
        });
        mockGetGuestQuizPreview.mockReturnValue({
            attemptCount: 0,
            correctCount: 0,
            avgResponseTimeMs: null,
        });
        mockRecordGuestQuizPreviewAttempt.mockReturnValue({
            attemptCount: 1,
            correctCount: 1,
            avgResponseTimeMs: 1200,
        });
        mockToggleFavoriteInStorage.mockReturnValue(baseProgress);
        mockAddQuizAttemptToStorage.mockReturnValue(baseProgress);
        mockUpdateTermInStorage.mockReturnValue([baseTerm]);
    });

    it('keeps cached streak data visible when cloud progress reload fails', async () => {
        mockGetUserProgress.mockReturnValue({
            ...baseProgress,
            current_streak: 5,
            last_study_date: '2026-03-10T10:00:00.000Z',
        });
        mockGetUserProgressFromSupabase.mockRejectedValue(new Error('Supabase unavailable'));

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('current-streak')).toHaveTextContent('5');
            expect(screen.getByTestId('last-study-date')).toHaveTextContent('2026-03-10T10:00:00.000Z');
        });
    });

    it('does not load unbounded SRS data when the authenticated user has no favorites', async () => {
        mockGetUserProgressFromSupabase.mockResolvedValue(okProgressResult({
            favorites: [],
        }));

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
        });

        expect(mockGetAllTermSRSFromSupabase).not.toHaveBeenCalled();
        expect(mockGetAllTermSRSFromSupabaseUnbounded).not.toHaveBeenCalled();
    });

    it('rolls back an authenticated favorite when server sync is retryable', async () => {
        mockGetUserProgress.mockReturnValue({
            ...baseProgress,
            favorites: [],
        });
        mockGetUserProgressFromSupabase.mockResolvedValue(okProgressResult({
            favorites: [],
        }));
        mockToggleFavoriteInSupabase.mockResolvedValue({
            status: 'retryable',
            message: 'Temporary failure',
        });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('favorites-count')).toHaveTextContent('0');
        });

        fireEvent.click(screen.getByRole('button', { name: 'favorite' }));

        await waitFor(() => {
            expect(screen.getByTestId('favorites-count')).toHaveTextContent('0');
            expect(screen.getByTestId('toggle-result')).toHaveTextContent('"success":false');
            expect(screen.getByTestId('toggle-result')).toHaveTextContent('"error":"Temporary failure"');
        });
    });

    it('rolls back an authenticated favorite when the session is expired', async () => {
        mockGetUserProgress.mockReturnValue({
            ...baseProgress,
            favorites: [],
        });
        mockGetUserProgressFromSupabase.mockResolvedValue(okProgressResult({
            favorites: [],
        }));
        mockToggleFavoriteInSupabase.mockResolvedValue({
            status: 'auth_expired',
            message: 'Session expired. Please sign in again to update favorites.',
        });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('favorites-count')).toHaveTextContent('0');
        });

        fireEvent.click(screen.getByRole('button', { name: 'favorite' }));

        await waitFor(() => {
            expect(screen.getByTestId('favorites-count')).toHaveTextContent('0');
            expect(screen.getByTestId('toggle-result')).toHaveTextContent('"success":false');
            expect(screen.getByTestId('toggle-result')).toHaveTextContent('"authExpired":true');
        });
    });

    it('returns limitReached when the server-side favorite cap is hit', async () => {
        mockGetUserProgress.mockReturnValue({
            ...baseProgress,
            favorites: [],
        });
        mockGetUserProgressFromSupabase.mockResolvedValue(okProgressResult({
            favorites: [],
        }));
        mockToggleFavoriteInSupabase.mockResolvedValue({
            status: 'limit_reached',
            message: 'Favorite limit reached. Complete your member setup to save more terms.',
        });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('favorites-count')).toHaveTextContent('0');
        });

        fireEvent.click(screen.getByRole('button', { name: 'favorite' }));

        await waitFor(() => {
            expect(screen.getByTestId('favorites-count')).toHaveTextContent('0');
            expect(screen.getByTestId('toggle-result')).toHaveTextContent('"success":false');
            expect(screen.getByTestId('toggle-result')).toHaveTextContent('"limitReached":true');
        });
    });

    it('persists merged favorites before SRS enrichment fails for authenticated users', async () => {
        mockGetUserProgress.mockReturnValue({
            ...baseProgress,
            favorites: ['term-1'],
        });
        mockGetUserProgressFromSupabase.mockResolvedValue({
            status: 'partial',
            data: {
                ...baseProgress,
                favorites: [],
            },
            missing: ['favorites'],
            message: 'Study progress loaded with gaps: favorites.',
        });
        mockGetAllTermSRSFromSupabase.mockResolvedValue({
            status: 'error',
            message: 'SRS unavailable',
        });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
        });

        expect(mockSaveUserProgress).toHaveBeenCalledWith(
            expect.objectContaining({
                favorites: ['term-1'],
            }),
            'user-1'
        );
    });

    it('fails closed for authenticated users when only guest progress is cached locally', async () => {
        authState = {
            ...authState,
            user: { id: 'user-2' },
        };
        mockUseAuth.mockImplementation(() => authState);
        mockGetUserProgress.mockImplementation((requestedUserId?: string) => {
            if (requestedUserId === 'user-2' || typeof requestedUserId === 'undefined') {
                return {
                    ...baseProgress,
                    user_id: 'user-2',
                    favorites: [],
                    current_streak: 0,
                };
            }

            return {
                ...baseProgress,
                user_id: 'guest_user',
                favorites: ['term-1'],
                current_streak: 5,
            };
        });
        mockGetUserProgressFromSupabase.mockRejectedValue(new Error('Supabase unavailable'));

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('current-streak')).toHaveTextContent('0');
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
        });
        expect(mockGetUserProgress).toHaveBeenCalledWith('user-2');
    });

    it('throws a hard error for guest quiz answers when the local term is missing', async () => {
        authState = {
            entitlements: {
                canUseAiFeatures: false,
                canUseAdvancedAnalytics: false,
                canUseMistakeReview: false,
                canUseReviewMode: false,
                canInstallPwa: true,
                maxFavorites: 15,
                requiresProfileCompletion: false,
            },
            favoriteLimit: 15,
            isAuthenticated: false,
            isLoading: false,
            requiresProfileCompletion: false,
            user: null,
        };
        mockUseAuth.mockImplementation(() => authState);
        mockGetTerms.mockReturnValue([]);
        mockGetUserProgress.mockReturnValue({
            ...baseProgress,
            user_id: 'guest_user',
        });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'answer' }));

        await waitFor(() => {
            expect(screen.getByTestId('submit-error')).toHaveTextContent('Review mode is unavailable');
        });

        expect(mockAddQuizAttemptToStorage).not.toHaveBeenCalled();
    });

    it('queues an auth-expired review without mutating canonical local study state', async () => {
        mockGetUserProgressFromSupabase
            .mockResolvedValueOnce(okProgressResult())
            .mockResolvedValue(okProgressResult({
                current_streak: 1,
                last_study_date: recordQuizResult.userProgress.last_study_date,
                updated_at: recordQuizResult.userProgress.updated_at,
            }));
        mockGetAllTermSRSFromSupabase
            .mockResolvedValueOnce({ status: 'ok', data: new Map() })
            .mockResolvedValue({
                status: 'ok',
                data: new Map([
                    ['term-1', {
                        srs_level: recordQuizResult.termSrs.srs_level,
                        next_review_date: recordQuizResult.termSrs.next_review_date,
                        last_reviewed: recordQuizResult.termSrs.last_reviewed,
                        difficulty_score: recordQuizResult.termSrs.difficulty_score,
                        retention_rate: recordQuizResult.termSrs.retention_rate,
                        times_reviewed: recordQuizResult.termSrs.times_reviewed,
                        times_correct: recordQuizResult.termSrs.times_correct,
                    }],
                ]),
            });
        mockSaveQuizAttemptToSupabase
            .mockResolvedValueOnce({
                status: 'auth_expired',
                message: 'Session expired. Please sign in again to save this answer.',
            })
            .mockResolvedValueOnce({
                status: 'ok',
                data: recordQuizResult,
            });

        const { unmount } = render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
        });

        fireEvent.click(screen.getByRole('button', { name: 'answer' }));

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
        });

        expect(mockSaveQuizAttemptToSupabase).toHaveBeenCalledTimes(1);
        expect(mockSaveQuizAttemptToSupabase.mock.calls[0]?.[1]).toMatchObject({
            id: 'review-key-1',
            term_id: 'term-1',
            timestamp: expect.any(String),
            quiz_type: 'daily',
            sessionId: 'session-1',
            sessionToken: 's'.repeat(32),
        });
        expect(mockUpdateTermAfterReview).not.toHaveBeenCalled();
        expect(mockAddQuizAttemptToStorage).not.toHaveBeenCalled();
        expect(screen.getByTestId('current-streak')).toHaveTextContent('0');
        expect(screen.getByTestId('quiz-history-count')).toHaveTextContent('0');
        expect(screen.queryByTestId('submit-error')).not.toBeInTheDocument();
        expect(mockShowToast).toHaveBeenCalledWith(
            'Session expired. This answer will retry after you sign in again.',
            'warning'
        );

        const queuedReview = JSON.parse(String(localStorage.getItem(pendingReviewQueueKey())));
        expect(queuedReview).toMatchObject([{
            reviewId: 'review-1',
            idempotencyKey: 'review-key-1',
            quizType: 'daily',
            sessionId: 'session-1',
            sessionToken: 's'.repeat(32),
        }]);
        expect(queuedReview[0]?.occurredAt).toBe(mockSaveQuizAttemptToSupabase.mock.calls[0]?.[1]?.timestamp);

        unmount();

        authState = {
            ...authState,
            isAuthenticated: false,
            user: null,
        };
        const secondRender = render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
        });

        authState = {
            ...authState,
            isAuthenticated: true,
            user: { id: 'user-1' },
        };
        secondRender.rerender(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(mockSaveQuizAttemptToSupabase).toHaveBeenCalledTimes(2);
        });

        expect(mockSaveQuizAttemptToSupabase.mock.calls[1]?.[1]).toMatchObject({
            id: 'review-key-1',
            term_id: 'term-1',
            timestamp: mockSaveQuizAttemptToSupabase.mock.calls[0]?.[1]?.timestamp,
            quiz_type: 'daily',
            sessionId: 'session-1',
            sessionToken: 's'.repeat(32),
        });
        expect(mockShowToast).toHaveBeenCalledWith('Restoring your pending answers…', 'info');
        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
        });
        expect(localStorage.getItem(pendingReviewQueueKey())).toBeNull();
    });

    it('drops a due card when another tab broadcasts a committed review through storage sync', async () => {
        authState = {
            entitlements: {
                canUseAiFeatures: true,
                canUseAdvancedAnalytics: true,
                canUseMistakeReview: true,
                canUseReviewMode: true,
                canInstallPwa: true,
                maxFavorites: Number.POSITIVE_INFINITY,
                requiresProfileCompletion: false,
            },
            favoriteLimit: Number.POSITIVE_INFINITY,
            isAuthenticated: true,
            isLoading: false,
            requiresProfileCompletion: false,
            user: { id: 'user-1' },
        };
        mockUseAuth.mockImplementation(() => authState);
        mockGetUserProgress.mockReturnValue({
            ...baseProgress,
            user_id: 'user-1',
            quiz_history: [{
                id: 'attempt-1',
                term_id: 'term-1',
                is_correct: true,
                response_time_ms: 0,
                timestamp: recordQuizResult.userProgress.updated_at,
                quiz_type: 'daily',
            }],
        });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
        });

        const syncPayload = JSON.stringify({
            type: 'REVIEW_COMMITTED',
            reviewId: 'review-2',
            termId: 'term-1',
            termSrs: recordQuizResult.termSrs,
            userProgress: recordQuizResult.userProgress,
            attempt: {
                id: 'attempt-1',
                term_id: 'term-1',
                is_correct: true,
                response_time_ms: 0,
                timestamp: recordQuizResult.userProgress.updated_at,
                quiz_type: 'daily',
            },
            emittedAt: Date.now(),
        });

        act(() => {
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'fintechterms_srs_sync',
                newValue: syncPayload,
            }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
            expect(screen.getByTestId('quiz-history-count')).toHaveTextContent('1');
        });
    });

    it('replays a pending review immediately on mount when the user is already authenticated', async () => {
        localStorage.setItem(pendingReviewQueueKey(), JSON.stringify([{
            reviewId: 'review-1',
            termId: 'term-1',
            isCorrect: true,
            responseTimeMs: 0,
            idempotencyKey: 'review-key-1',
            quizType: 'review',
            occurredAt: '2026-03-11T08:00:00.000Z',
            sessionId: 'queued-session',
            sessionToken: 'q'.repeat(32),
            queuedAt: Date.now(),
        }]));
        mockSaveQuizAttemptToSupabase.mockResolvedValue({
            status: 'ok',
            data: recordQuizResult,
        });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(mockSaveQuizAttemptToSupabase).toHaveBeenCalledTimes(1);
        });

        expect(mockSaveQuizAttemptToSupabase.mock.calls[0]?.[1]).toMatchObject({
            id: 'review-key-1',
            response_time_ms: 0,
            timestamp: '2026-03-11T08:00:00.000Z',
            quiz_type: 'review',
            sessionId: 'queued-session',
            sessionToken: 'q'.repeat(32),
        });
        expect(mockShowToast).toHaveBeenCalledWith('Restoring your pending answers…', 'info');

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
        });
        expect(localStorage.getItem(pendingReviewQueueKey())).toBeNull();
    });

    it('queues a retryable review without mutating canonical local study state', async () => {
        mockSaveQuizAttemptToSupabase
            .mockResolvedValueOnce({
                status: 'retryable',
                message: 'Temporary outage',
            })
            .mockResolvedValueOnce({
                status: 'ok',
                data: recordQuizResult,
            });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
        });

        fireEvent.click(screen.getByRole('button', { name: 'answer' }));

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
        });
        expect(mockUpdateTermAfterReview).not.toHaveBeenCalled();
        expect(mockAddQuizAttemptToStorage).not.toHaveBeenCalled();
        expect(screen.getByTestId('current-streak')).toHaveTextContent('0');
        expect(screen.getByTestId('quiz-history-count')).toHaveTextContent('0');
        expect(screen.queryByTestId('submit-error')).not.toBeInTheDocument();
        expect(mockShowToast).toHaveBeenCalledWith(
            'This answer was queued for sync on this device.',
            'warning'
        );
        expect(localStorage.getItem(pendingReviewQueueKey())).not.toBeNull();

        act(() => {
            window.dispatchEvent(new Event('online'));
        });

        await waitFor(() => {
            expect(mockSaveQuizAttemptToSupabase).toHaveBeenCalledTimes(2);
        });
        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
            expect(screen.getByTestId('current-streak')).toHaveTextContent('1');
        });
        expect(localStorage.getItem(pendingReviewQueueKey())).toBeNull();
    });

    it('marks a queued review as action-required instead of deleting it when replay fails non-retryably', async () => {
        mockSaveQuizAttemptToSupabase
            .mockResolvedValueOnce({
                status: 'retryable',
                message: 'Temporary outage',
            })
            .mockResolvedValueOnce({
                status: 'non_retryable',
                message: 'Term must be in favorites before review.',
            });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
        });

        fireEvent.click(screen.getByRole('button', { name: 'answer' }));

        await waitFor(() => {
            expect(localStorage.getItem(pendingReviewQueueKey())).not.toBeNull();
        });

        act(() => {
            window.dispatchEvent(new Event('online'));
        });

        await waitFor(() => {
            expect(mockSaveQuizAttemptToSupabase).toHaveBeenCalledTimes(2);
        });

        const persistedQueue = JSON.parse(localStorage.getItem(pendingReviewQueueKey()) ?? '[]') as Array<Record<string, unknown>>;

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
            expect(screen.getByTestId('current-streak')).toHaveTextContent('0');
            expect(screen.getByTestId('quiz-history-count')).toHaveTextContent('0');
        });

        expect(persistedQueue).toHaveLength(1);
        expect(persistedQueue[0]).toMatchObject({
            reviewId: 'review-1',
            status: 'action_required',
            reason: 'Term must be in favorites before review.',
        });
        expect(mockUpdateTermAfterReview).not.toHaveBeenCalled();
        expect(mockAddQuizAttemptToStorage).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith(
            'A queued answer now needs manual attention before it can be synced.',
            'warning'
        );
    });

    it('replays a queued review when the study session becomes ready', async () => {
        mockSaveQuizAttemptToSupabase
            .mockResolvedValueOnce({
                status: 'retryable',
                message: 'Study session is still syncing. This answer will retry shortly.',
            })
            .mockResolvedValueOnce({
                status: 'ok',
                data: recordQuizResult,
            });

        render(
            <SRSProvider>
                <TestConsumer />
            </SRSProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('1');
        });

        fireEvent.click(screen.getByRole('button', { name: 'answer' }));

        await waitFor(() => {
            expect(localStorage.getItem(pendingReviewQueueKey())).not.toBeNull();
        });

        act(() => {
            window.dispatchEvent(new Event(STUDY_SESSION_READY_EVENT));
        });

        await waitFor(() => {
            expect(mockSaveQuizAttemptToSupabase).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(localStorage.getItem(pendingReviewQueueKey())).toBeNull();
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
        });
    });
});
