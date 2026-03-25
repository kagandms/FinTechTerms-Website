/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SRSProvider, useSRS } from '@/contexts/SRSContext';
import type { UserProgress } from '@/types';

const mockUseAuth = jest.fn();
const mockShowToast = jest.fn();
const mockGetTerms = jest.fn();
const mockSaveTerms = jest.fn();
const mockUpdateTermInStorage = jest.fn();
const mockGetUserProgress = jest.fn();
const mockToggleFavoriteInStorage = jest.fn();
const mockAddQuizAttemptToStorage = jest.fn();
const mockSaveUserProgress = jest.fn();
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
    const { dueTerms, submitQuizAnswer, userProgress } = useSRS();
    const [error, setError] = React.useState<string | null>(null);

    return (
        <div>
            <div data-testid="due-count">{dueTerms.length}</div>
            <div data-testid="current-streak">{userProgress.current_streak}</div>
            <div data-testid="last-study-date">{userProgress.last_study_date ?? 'none'}</div>
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
            {error ? <div data-testid="submit-error">{error}</div> : null}
        </div>
    );
}

describe('SRSContext', () => {
    let authState: {
        favoriteLimit: number;
        isAuthenticated: boolean;
        isLoading: boolean;
        user: { id: string } | null;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();

        authState = {
            favoriteLimit: Number.POSITIVE_INFINITY,
            isAuthenticated: true,
            isLoading: false,
            user: { id: 'user-1' },
        };

        mockUseAuth.mockImplementation(() => authState);
        mockGetTerms.mockReturnValue([baseTerm]);
        mockGetUserProgress.mockReturnValue(baseProgress);
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
            favoriteLimit: 50,
            isAuthenticated: false,
            isLoading: false,
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
            expect(screen.getByTestId('submit-error')).toHaveTextContent('QUIZ_TERM_MISSING');
        });

        expect(mockAddQuizAttemptToStorage).not.toHaveBeenCalled();
    });

    it('replays an auth-expired review after remount/login with the same idempotency key', async () => {
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
            expect(screen.getByTestId('submit-error')).toHaveTextContent('Session expired. Please sign in again to save this answer.');
        });

        expect(mockSaveQuizAttemptToSupabase).toHaveBeenCalledTimes(1);
        expect(mockSaveQuizAttemptToSupabase.mock.calls[0]?.[1]).toMatchObject({
            id: 'review-key-1',
            term_id: 'term-1',
        });
        expect(screen.getByTestId('due-count')).toHaveTextContent('1');

        expect(JSON.parse(String(sessionStorage.getItem('fintechterms_pending_review')))).toMatchObject({
            reviewId: 'review-1',
            idempotencyKey: 'review-key-1',
        });

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
        });
        expect(mockShowToast).toHaveBeenCalledWith('Restoring your pending answer…', 'info');

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
        });
        expect(sessionStorage.getItem('fintechterms_pending_review')).toBeNull();
    });

    it('drops a due card when another tab broadcasts a committed review through storage sync', async () => {
        authState = {
            favoriteLimit: 50,
            isAuthenticated: false,
            isLoading: false,
            user: null,
        };
        mockUseAuth.mockImplementation(() => authState);

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
                id: 'review-2',
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
        });
    });

    it('replays a pending review immediately on mount when the user is already authenticated', async () => {
        sessionStorage.setItem('fintechterms_pending_review', JSON.stringify({
            reviewId: 'review-1',
            termId: 'term-1',
            isCorrect: true,
            responseTimeMs: 0,
            idempotencyKey: 'review-key-1',
        }));
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
        });
        expect(mockShowToast).toHaveBeenCalledWith('Restoring your pending answer…', 'info');

        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
        });
        expect(sessionStorage.getItem('fintechterms_pending_review')).toBeNull();
    });

    it('persists retryable review failures and replays them when the browser comes back online', async () => {
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
            expect(screen.getByTestId('submit-error')).toHaveTextContent(
                'Answer saved locally. It will sync when connection returns.'
            );
        });
        expect(sessionStorage.getItem('fintechterms_pending_review')).not.toBeNull();

        act(() => {
            window.dispatchEvent(new Event('online'));
        });

        await waitFor(() => {
            expect(mockSaveQuizAttemptToSupabase).toHaveBeenCalledTimes(2);
        });
        await waitFor(() => {
            expect(screen.getByTestId('due-count')).toHaveTextContent('0');
        });
        expect(sessionStorage.getItem('fintechterms_pending_review')).toBeNull();
    });
});
