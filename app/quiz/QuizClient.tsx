'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import QuizCard from '@/components/QuizCard';
import MultipleChoiceQuizCard from '@/components/MultipleChoiceQuizCard';
import DataStateCard from '@/components/DataStateCard';
import Link from 'next/link';
import { Trophy, ArrowRight, Heart, Sparkles, Flame, Zap, BookOpen, Star, Target, X, Loader2, RefreshCw } from 'lucide-react';

import { incrementQuizAttempt } from '@/components/SessionTracker';
import { createIdempotencyKey } from '@/lib/idempotency';
import { serializeJsonLd } from '@/lib/json-ld';
import { resolveHomeHref } from '@/lib/navigation';
import { buildMultipleChoiceQuestion } from '@/lib/quiz/multiple-choice';
import type { QuizAnswerRequest, QuizAnswerResult } from '@/components/quiz-answer-types';
import type { QuizPresentationMode } from '@/types';
import { fetchQuizFeedback } from '@/lib/ai/client';
import { getAiUiCopy } from '@/lib/ai-copy';
import type { AiQuizFeedback } from '@/types/ai';
import ValueHintList from '@/components/membership/ValueHintList';
import { formatTranslation } from '@/lib/i18n';

const QUIZ_SUBMISSION_TIMEOUT_MS = 10_000;
const PRACTICE_MODE_CARD_CLASS = 'rounded-2xl p-4 text-white shadow-lg min-h-[220px] flex flex-col';
const PRACTICE_MODE_BUTTON_CLASS = 'mt-auto w-full rounded-xl bg-white py-2.5 text-sm font-semibold transition-colors hover:bg-gray-100';

interface QuizPageProps {
    nonce?: string;
}

interface PausedWrongAnswerState {
    termId: string;
    selectedWrongLabel: string | null;
}

const stateMessages = {
    tr: {
        loadingTitle: 'Quiz yukleniyor',
        loadingDescription: 'Calisma verileri hazirlaniyor. Lutfen bekleyin.',
        syncingTitle: 'Tekrar verileri senkronize ediliyor',
        syncingDescription: 'Hizli quiz kullanilabilir. Tekrar kartlari arka planda hazirlaniyor.',
        errorTitle: 'Veri yukleme hatasi',
        errorDescription: 'Quiz verileri simdi yuklenemedi. Lutfen tekrar deneyin.',
        degradedTitle: 'Kaydedilen verilerle devam ediliyor',
        degradedDescription: 'Sunucuya ulasilamadi. Gosterilen tekrar ve istatistik verileri son kaydedilen durum olabilir.',
        srsUnavailableTitle: 'SRS verileri gecici olarak kullanilamiyor',
        srsUnavailableDescription: 'Hizli quiz kullanilabilir, ancak tekrar kartlari ve favori istatistikleri su anda yuklenemedi.',
        slowLoadingTitle: 'Yukleme uzun suruyor',
        slowLoadingDescription: 'Yukleme uzun suruyor. Lutfen tekrar deneyin.',
        availableQuestions: 'Uygun soru',
        noQuestionsAvailable: 'Bu filtre icin uygun soru yok.',
        noQuestionsTooltip: 'Bu filtre icin soru bulunmadigi icin quiz baslatilamiyor.',
        retry: 'Tekrar Dene',
        reviewLockedTitle: 'Tam SRS tekrarı üyelik gerektirir',
        reviewLockedDescription: 'Hızlı quiz kullanılabilir. Kalıcı aralıklı tekrar planı için hesap oluşturun veya profilinizi tamamlayın.',
        reviewLockedCta: 'Profili Aç',
        mistakeReviewTitle: 'Hata tekrarı',
        mistakeReviewDescription: 'Yakın zamanda yanlış cevapladığınız terimleri tekrar çalışın.',
        noMistakeReviewTitle: 'Hata tekrar kuyruğu boş',
        noMistakeReviewDescription: 'Yanlış cevaplanan terim yok. Önce hızlı quiz çözerek bu modu doldurun.',
    },
    en: {
        loadingTitle: 'Loading quiz',
        loadingDescription: 'Study data is being prepared. Please wait.',
        syncingTitle: 'Syncing review data',
        syncingDescription: 'Quick Quiz is available now. Review cards are still being prepared in the background.',
        errorTitle: 'Data loading error',
        errorDescription: 'Quiz data could not be loaded right now. Please try again.',
        degradedTitle: 'Continuing with saved data',
        degradedDescription: 'The server is unavailable. Review data and statistics may be based on your latest saved session.',
        srsUnavailableTitle: 'SRS data is temporarily unavailable',
        srsUnavailableDescription: 'Quick Quiz is available, but review cards and favorites-based stats could not be loaded.',
        slowLoadingTitle: 'Loading is taking too long',
        slowLoadingDescription: 'Loading is taking too long — please try again.',
        availableQuestions: 'Available questions',
        noQuestionsAvailable: 'No questions match this filter.',
        noQuestionsTooltip: 'Start Quiz is disabled because there are no matching questions.',
        retry: 'Try Again',
        reviewLockedTitle: 'Full SRS review requires membership',
        reviewLockedDescription: 'Quick Quiz is available now. Create an account or complete your profile to unlock permanent spaced repetition.',
        reviewLockedCta: 'Open Profile',
        mistakeReviewTitle: 'Mistake review',
        mistakeReviewDescription: 'Revisit the terms you answered incorrectly most recently.',
        noMistakeReviewTitle: 'Mistake review queue is empty',
        noMistakeReviewDescription: 'There are no recent incorrect answers yet. Use Quick Quiz first to build this queue.',
    },
    ru: {
        loadingTitle: 'Загружаем квиз',
        loadingDescription: 'Подготавливаем учебные данные. Пожалуйста, подождите.',
        syncingTitle: 'Синхронизируем данные повторения',
        syncingDescription: 'Быстрый квиз уже доступен. Карточки повтора готовятся в фоне.',
        errorTitle: 'Ошибка загрузки данных',
        errorDescription: 'Сейчас не удалось загрузить данные для квиза. Попробуйте еще раз.',
        degradedTitle: 'Показаны сохраненные данные',
        degradedDescription: 'Сервер недоступен. Повторение и статистика могут отображаться по последнему сохраненному состоянию.',
        srsUnavailableTitle: 'Данные SRS временно недоступны',
        srsUnavailableDescription: 'Быстрый квиз доступен, но карточки повторения и статистика по избранному сейчас не загрузились.',
        slowLoadingTitle: 'Загрузка занимает слишком много времени',
        slowLoadingDescription: 'Загрузка занимает слишком много времени. Попробуйте еще раз.',
        availableQuestions: 'Доступные вопросы',
        noQuestionsAvailable: 'Для этого фильтра нет доступных вопросов.',
        noQuestionsTooltip: 'Кнопка запуска отключена, потому что подходящих вопросов нет.',
        retry: 'Повторить',
        reviewLockedTitle: 'Полный SRS-режим доступен только участникам',
        reviewLockedDescription: 'Быстрый квиз доступен уже сейчас. Создайте аккаунт или заполните профиль, чтобы открыть постоянное интервальное повторение.',
        reviewLockedCta: 'Открыть профиль',
        mistakeReviewTitle: 'Повтор ошибок',
        mistakeReviewDescription: 'Повторите термины, на которые вы недавно ответили неправильно.',
        noMistakeReviewTitle: 'Очередь повторения ошибок пуста',
        noMistakeReviewDescription: 'Пока нет недавних неправильных ответов. Сначала пройдите быстрый квиз.',
    },
} as const;

export default function QuizPage({ nonce }: QuizPageProps) {
    const { t, language } = useLanguage();
    const { entitlements, isAuthenticated, requiresProfileCompletion } = useAuth();
    const {
        dueTerms,
        quizPreview,
        mistakeReviewQueue,
        recordQuizPreviewAttempt,
        recordMistakeReviewMiss,
        clearMistakeReviewTerm,
        submitQuizAnswer,
        stats,
        terms,
        userProgress,
        termsStatus,
        progressStatus,
        refreshData,
    } = useSRS();
    const stateCopy = stateMessages[language] ?? stateMessages.en;
    const aiCopy = getAiUiCopy(language);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [sessionTerms, setSessionTerms] = useState<typeof dueTerms>([]);
    const [isQuickQuiz, setIsQuickQuiz] = useState(false);
    const [isMistakeReview, setIsMistakeReview] = useState(false);
    const [showQuizOptions, setShowQuizOptions] = useState(false);
    const [hasChosenMode, setHasChosenMode] = useState(false);
    const [quickQuizCategory, setQuickQuizCategory] = useState<string | null>(null);
    const [quickQuizConfiguratorMode, setQuickQuizConfiguratorMode] = useState<QuizPresentationMode | null>(null);
    const [quickQuizSessionPool, setQuickQuizSessionPool] = useState<typeof terms>([]);
    const [quizPresentationMode, setQuizPresentationMode] = useState<QuizPresentationMode>('flashcard');
    const [useOnlyFavorites, setUseOnlyFavorites] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [isSubmissionSlow, setIsSubmissionSlow] = useState(false);
    const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
    const [showSavedIndicator, setShowSavedIndicator] = useState(false);
    const [pausedWrongAnswer, setPausedWrongAnswer] = useState<PausedWrongAnswerState | null>(null);
    const [quizFeedback, setQuizFeedback] = useState<AiQuizFeedback | null>(null);
    const [quizFeedbackStatus, setQuizFeedbackStatus] = useState<'idle' | 'loading' | 'ready' | 'locked' | 'error'>('idle');
    const [quizFeedbackError, setQuizFeedbackError] = useState<string | null>(null);
    const submissionSlowTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

    // Prevents dynamic shrinking of sessionTerms when dueTerms completes during a session
    const [hasStartedNormalQuiz, setHasStartedNormalQuiz] = useState(false);

    const quizOptions = [5, 10, 20, 50];
    const masteredCount = stats.mastered;
    const learningCount = stats.learning;
    const canUseReviewMode = entitlements.canUseReviewMode;
    const hasBlockingTermsError = termsStatus === 'error' || (termsStatus === 'degraded' && terms.length === 0);
    const hasCachedProgressData = dueTerms.length > 0
        || userProgress.favorites.length > 0
        || userProgress.quiz_history.length > 0
        || userProgress.current_streak > 0;
    const canUseProgressData = canUseReviewMode
        && (progressStatus === 'ready' || (progressStatus === 'degraded' && hasCachedProgressData));
    const shouldShowProgressFallback = canUseReviewMode
        && (progressStatus === 'error' || (progressStatus === 'degraded' && !hasCachedProgressData));
    const shouldShowDegradedNotice = canUseReviewMode
        && ((termsStatus === 'degraded' && terms.length > 0)
            || (progressStatus === 'degraded' && hasCachedProgressData));
    const isRouteLoading = termsStatus === 'loading' && terms.length === 0;
    const showProgressSyncNotice = canUseReviewMode && progressStatus === 'loading' && terms.length > 0;
    const recentWrongTerms = userProgress.quiz_history
        .filter((attempt) => !attempt.is_correct)
        .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
    const queuedMistakeTerms = mistakeReviewQueue
        .map((termId) => terms.find((term) => term.id === termId))
        .filter((term): term is typeof terms[number] => Boolean(term));
    const historicalMistakeTerms = recentWrongTerms
        .map((attempt) => terms.find((term) => term.id === attempt.term_id))
        .filter((term): term is typeof terms[number] => Boolean(term));
    const mistakeReviewPool = Array.from(
        new Map(
            [...queuedMistakeTerms, ...historicalMistakeTerms]
                .map((term) => [term.id, term] as const)
        ).values()
    ).slice(0, 20);

    const getQuickQuizPool = (category: string | null) => {
        let pool = [...terms];

        if (useOnlyFavorites && canUseProgressData) {
            pool = pool.filter((term) => userProgress.favorites.includes(term.id));
        }

        if (category && category !== 'all') {
            pool = pool.filter((term) => term.category === category);
        }

        return pool;
    };

    const quickQuizPool = getQuickQuizPool(quickQuizCategory);
    const quickQuizAvailableCount = quickQuizPool.length;
    const currentTerm = sessionTerms[currentIndex];
    const currentMultipleChoiceQuestion = (
        currentTerm
        && isQuickQuiz
        && quizPresentationMode === 'multiple-choice'
    )
        ? buildMultipleChoiceQuestion(currentTerm, quickQuizSessionPool, terms, language)
        : null;
    const reviewUnlockHref = requiresProfileCompletion ? '/profile?complete=1' : '/profile';
    const hasFullAiAccess = isAuthenticated && entitlements.canUseAiFeatures;
    const membershipHintItems = [
        t('membership.items.srs'),
        t('membership.items.aiFeedback'),
        t('membership.items.studyCoach'),
        t('membership.items.sync'),
    ];
    const favoritesOnlyMinimumRequired = 5;
    const favoritesOnlyAvailableCount = userProgress.favorites.length;
    const canUseFavoritesOnlyMode = favoritesOnlyAvailableCount >= favoritesOnlyMinimumRequired;
    const favoritesMinimumRequiredMessage = formatTranslation(
        t('quiz.favoritesMinimumRequired'),
        { count: favoritesOnlyMinimumRequired }
    );

    // Initialize session terms only AFTER user has chosen SRS mode
    useEffect(() => {
        if (!isQuickQuiz && !isMistakeReview && hasChosenMode && !hasStartedNormalQuiz && dueTerms.length > 0) {
            setSessionTerms(dueTerms);
            setHasStartedNormalQuiz(true);
        } else if (!isQuickQuiz && !isMistakeReview && hasChosenMode && !hasStartedNormalQuiz && dueTerms.length === 0) {
            setSessionTerms([]);
        }
    }, [dueTerms, isMistakeReview, isQuickQuiz, hasStartedNormalQuiz, hasChosenMode]);

    useEffect(() => {
        if (!currentTerm || isQuickQuiz) {
            setCurrentReviewId(null);
            return;
        }

        setCurrentReviewId(createIdempotencyKey());
    }, [currentIndex, currentTerm, isQuickQuiz]);

    // Start quick quiz with selected word count and category
    const openQuickQuizConfigurator = (mode: QuizPresentationMode) => {
        setQuickQuizConfiguratorMode(mode);
        setShowQuizOptions(true);
        setQuickQuizCategory(null);
        setSubmissionError(null);
    };

    const startQuickQuiz = (count: number, modeOverride?: QuizPresentationMode) => {
        const pool = getQuickQuizPool(quickQuizCategory);
        const shuffled = pool.sort(() => Math.random() - 0.5);
        const quizTerms = shuffled.slice(0, Math.min(count, pool.length));
        setSessionTerms(quizTerms);
        setQuickQuizSessionPool(pool);
        setCurrentIndex(0);
        setCorrectCount(0);
        setIsComplete(false);
        setIsQuickQuiz(true);
        setShowQuizOptions(false);
        setQuickQuizCategory(null);
        setQuizPresentationMode(modeOverride ?? quickQuizConfiguratorMode ?? 'flashcard');
        setQuickQuizConfiguratorMode(null);
        setSubmissionError(null);
    };

    const startMistakeReview = () => {
        setSessionTerms(mistakeReviewPool);
        setCurrentIndex(0);
        setCorrectCount(0);
        setIsComplete(false);
        setIsQuickQuiz(false);
        setIsMistakeReview(true);
        setHasChosenMode(true);
        setHasStartedNormalQuiz(true);
        setShowQuizOptions(false);
        setQuickQuizCategory(null);
        setQuickQuizConfiguratorMode(null);
        setQuickQuizSessionPool([]);
        setQuizPresentationMode('flashcard');
        setSubmissionError(null);
    };

    const advanceToNextTerm = () => {
        if (currentIndex + 1 >= sessionTerms.length) {
            setIsComplete(true);
            return;
        }

        setCurrentIndex((index) => index + 1);
    };

    const handleAnswer = async ({
        isCorrect,
        responseTimeMs,
        selectedOptionLabel,
    }: QuizAnswerRequest): Promise<QuizAnswerResult | void> => {
        if (!currentTerm || isPending) return;

        setIsPending(true);
        setSubmissionError(null);
        setIsSubmissionSlow(false);

        if (submissionSlowTimerRef.current) {
            globalThis.clearTimeout(submissionSlowTimerRef.current);
        }
        submissionSlowTimerRef.current = globalThis.setTimeout(() => {
            setIsSubmissionSlow(true);
        }, QUIZ_SUBMISSION_TIMEOUT_MS);

        try {
            // Submit to SRS system (only for actual favorites, not quick quiz)
            if (!isQuickQuiz) {
                await submitQuizAnswer(
                    currentTerm.id,
                    isCorrect,
                    responseTimeMs,
                    currentReviewId ?? createIdempotencyKey(),
                    isMistakeReview ? 'review' : 'daily'
                );
                incrementQuizAttempt();
                setShowSavedIndicator(true);
            } else if (!entitlements.canUseAdvancedAnalytics) {
                recordQuizPreviewAttempt(isCorrect, responseTimeMs);
            }

            if (entitlements.canUseMistakeReview && isQuickQuiz && !isCorrect) {
                recordMistakeReviewMiss(currentTerm.id);
            }

            if (entitlements.canUseMistakeReview && isMistakeReview && isCorrect) {
                clearMistakeReviewTerm(currentTerm.id);
            }

            if (isCorrect) {
                setCorrectCount(c => c + 1);
            }

            if (!isCorrect) {
                setPausedWrongAnswer({
                    termId: currentTerm.id,
                    selectedWrongLabel: selectedOptionLabel ?? null,
                });

                if (hasFullAiAccess) {
                    setQuizFeedbackStatus('loading');
                    setQuizFeedback(null);
                    setQuizFeedbackError(null);

                    void fetchQuizFeedback({
                        termId: currentTerm.id,
                        language,
                        selectedWrongLabel: selectedOptionLabel ?? null,
                    })
                        .then((feedback) => {
                            setQuizFeedback(feedback);
                            setQuizFeedbackStatus('ready');
                        })
                        .catch((error) => {
                            setQuizFeedback(null);
                            setQuizFeedbackStatus('error');
                            setQuizFeedbackError(error instanceof Error ? error.message : stateCopy.slowLoadingDescription);
                        });
                } else {
                    setQuizFeedback(null);
                    setQuizFeedbackError(null);
                    setQuizFeedbackStatus('locked');
                }

                return { keepLocked: true };
            }

            advanceToNextTerm();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : stateCopy.slowLoadingDescription);
        } finally {
            if (submissionSlowTimerRef.current) {
                globalThis.clearTimeout(submissionSlowTimerRef.current);
                submissionSlowTimerRef.current = null;
            }
            setIsSubmissionSlow(false);
            setIsPending(false);
        }
    };

    useEffect(() => () => {
        if (submissionSlowTimerRef.current) {
            globalThis.clearTimeout(submissionSlowTimerRef.current);
        }
    }, []);

    const continueAfterWrongAnswer = () => {
        setPausedWrongAnswer(null);
        setQuizFeedback(null);
        setQuizFeedbackError(null);
        setQuizFeedbackStatus('idle');
        advanceToNextTerm();
    };

    // Reset to mode selection
    const resetToNormal = () => {
        setIsQuickQuiz(false);
        setIsMistakeReview(false);
        setHasStartedNormalQuiz(false);
        setHasChosenMode(false);
        setSessionTerms([]);
        setCurrentIndex(0);
        setCorrectCount(0);
        setIsComplete(false);
        setShowQuizOptions(false);
        setQuickQuizCategory(null);
        setQuickQuizConfiguratorMode(null);
        setQuickQuizSessionPool([]);
        setQuizPresentationMode('flashcard');
        setUseOnlyFavorites(false);
        setSubmissionError(null);
        setIsSubmissionSlow(false);
        setCurrentReviewId(null);
        setShowSavedIndicator(false);
        setPausedWrongAnswer(null);
        setQuizFeedback(null);
        setQuizFeedbackError(null);
        setQuizFeedbackStatus('idle');
    };

    // Start SRS review mode
    const startSrsReview = () => {
        if (!canUseReviewMode) {
            return;
        }
        setHasChosenMode(true);
        setIsQuickQuiz(false);
        setIsMistakeReview(false);
    };

    // Mode Selection Screen — show when user hasn't chosen a mode yet
    if (!hasChosenMode && !isQuickQuiz) {
        return (
            <div className="page-content px-4 py-6">
                {/* Header */}
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('quiz.title')}</h1>
                    {!isRouteLoading && canUseProgressData && dueTerms.length > 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('quiz.chooseMode')}</p>
                    )}
                    <span className="sr-only" data-testid="due-card-count">
                        {dueTerms.length}
                    </span>
                </header>

                {isRouteLoading ? (
                    <DataStateCard
                        title={stateCopy.loadingTitle}
                        description={stateCopy.loadingDescription}
                        icon={<Loader2 className="w-10 h-10 animate-spin text-primary-500" />}
                    />
                ) : hasBlockingTermsError ? (
                    <DataStateCard
                        tone="error"
                        title={stateCopy.errorTitle}
                        description={stateCopy.errorDescription}
                        action={(
                            <button
                                onClick={refreshData}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-600"
                            >
                                <RefreshCw className="w-4 h-4" />
                                {stateCopy.retry}
                            </button>
                        )}
                    />
                ) : (
                    <>
                        {shouldShowDegradedNotice ? (
                            <div className="mb-4">
                                <DataStateCard
                                    tone="warning"
                                    title={stateCopy.degradedTitle}
                                    description={stateCopy.degradedDescription}
                                    action={(
                                        <button
                                            onClick={refreshData}
                                            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            {stateCopy.retry}
                                        </button>
                                    )}
                                />
                            </div>
                        ) : null}

                        {showProgressSyncNotice ? (
                            <div className="mb-4">
                                <DataStateCard
                                    title={stateCopy.syncingTitle}
                                    description={stateCopy.syncingDescription}
                                    icon={<Loader2 className="w-10 h-10 animate-spin text-primary-500" />}
                                />
                            </div>
                        ) : null}

                        {/* Daily Streak Card - Compact */}
                        {canUseProgressData ? (
                            <div className="mb-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white shadow-md md:max-w-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-white/20 rounded-full">
                                            <Flame className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-white/80 text-xs">{t('quiz.dailyStreak')}</p>
                                            <p className="text-xl font-bold">{userProgress.current_streak || 0} {t('quiz.days')}</p>
                                        </div>
                                    </div>
                                    {(userProgress.current_streak || 0) > 0 && (
                                        <p className="text-lg">🔥</p>
                                    )}
                                </div>
                            </div>
                        ) : showProgressSyncNotice || !canUseReviewMode ? null : (
                            <div className="mb-4">
                                <DataStateCard
                                    tone="error"
                                    title={stateCopy.srsUnavailableTitle}
                                    description={stateCopy.srsUnavailableDescription}
                                    action={(
                                        <button
                                            onClick={refreshData}
                                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-600"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            {stateCopy.retry}
                                        </button>
                                    )}
                                />
                            </div>
                        )}

                        {!canUseReviewMode ? (
                            <div className="mb-4 rounded-2xl border border-primary-100 bg-primary-50 p-5 shadow-sm dark:border-primary-900/40 dark:bg-primary-900/20">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{stateCopy.reviewLockedTitle}</h2>
                                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                                    {stateCopy.reviewLockedDescription}
                                </p>
                                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {t('membership.quizHint')}
                                </p>
                                <div className="mt-4">
                                    <ValueHintList
                                        title={t('membership.hintTitle')}
                                        items={membershipHintItems}
                                        tone="strong"
                                    />
                                </div>
                                <Link
                                    href={reviewUnlockHref}
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-600"
                                >
                                    <span>{stateCopy.reviewLockedCta}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : null}

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                        {/* SRS Review Card — only when dueTerms exist */}
                        {canUseProgressData && dueTerms.length > 0 && (
                            <div className={`${PRACTICE_MODE_CARD_CLASS} bg-gradient-to-r from-emerald-500 to-teal-500`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-white/20 rounded-full">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold">{t('quiz.srsReview')}</p>
                                        <p className="text-white/80 text-xs">{t('quiz.srsReviewDesc')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-white/90 text-sm font-medium">{dueTerms.length} {t('quiz.cardsDue')}</span>
                                </div>
                                <button
                                    onClick={startSrsReview}
                                    data-testid="start-srs-review"
                                    className={`${PRACTICE_MODE_BUTTON_CLASS} text-emerald-600`}
                                >
                                    {t('quiz.startSrsReview')}
                                </button>
                            </div>
                        )}

                        {entitlements.canUseMistakeReview && (
                            <div className={`${PRACTICE_MODE_CARD_CLASS} bg-gradient-to-r from-rose-500 to-pink-500`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-white/20 rounded-full">
                                        <X className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold">{stateCopy.mistakeReviewTitle}</p>
                                        <p className="text-white/80 text-xs">{stateCopy.mistakeReviewDescription}</p>
                                    </div>
                                </div>
                                {mistakeReviewPool.length > 0 ? (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/90 text-sm font-medium">{mistakeReviewPool.length} {t('quiz.cardsDue')}</span>
                                        </div>
                                        <button
                                            onClick={startMistakeReview}
                                            data-testid="start-mistake-review"
                                            className={`${PRACTICE_MODE_BUTTON_CLASS} text-rose-600`}
                                        >
                                            {stateCopy.mistakeReviewTitle}
                                        </button>
                                    </>
                                ) : (
                                    <p className="text-sm text-white/90">
                                        {stateCopy.noMistakeReviewDescription}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Flashcard Quick Quiz Card */}
                        <div className={`${PRACTICE_MODE_CARD_CLASS} bg-gradient-to-r from-primary-500 to-blue-500`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-white/20 rounded-full">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold">{t('quiz.quickQuiz')}</p>
                                    <p className="text-white/80 text-xs">{t('quiz.quickQuizDesc')}</p>
                                </div>
                            </div>

                            {!showQuizOptions || quickQuizConfiguratorMode !== 'flashcard' ? (
                                <button
                                    onClick={() => openQuickQuizConfigurator('flashcard')}
                                    className={`${PRACTICE_MODE_BUTTON_CLASS} text-primary-600`}
                                >
                                    {t('quiz.startQuickQuiz')}
                                </button>
                            ) : !quickQuizCategory ? (
                                /* Category Selection Step */
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-white/80 text-xs">
                                            {t('quiz.categorySelect')}
                                        </p>
                                        {canUseProgressData && stats.totalFavorites > 0 && (
                                            <button
                                                onClick={() => {
                                                    if (!canUseFavoritesOnlyMode) {
                                                        setSubmissionError(favoritesMinimumRequiredMessage);
                                                        return;
                                                    }
                                                    setUseOnlyFavorites(!useOnlyFavorites);
                                                }}
                                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border ${useOnlyFavorites
                                                    ? 'bg-white text-red-500 border-white'
                                                    : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                                                    } ${!canUseFavoritesOnlyMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={!canUseFavoritesOnlyMode}
                                            >
                                                <Heart className={`w-2.5 h-2.5 ${useOnlyFavorites ? 'fill-current' : ''}`} />
                                                {t('quiz.favoritesOnly')}
                                            </button>
                                        )}
                                    </div>
                                    {!canUseFavoritesOnlyMode && canUseProgressData && stats.totalFavorites > 0 ? (
                                        <p className="text-white/80 text-[11px]">
                                            {favoritesMinimumRequiredMessage}
                                        </p>
                                    ) : null}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'all', label: t('quiz.categoryAll') },
                                            { key: 'Finance', label: t('categories.Finance') },
                                            { key: 'Technology', label: t('quiz.categoryTechnology') },
                                            { key: 'Fintech', label: t('categories.Fintech') },
                                        ].map(cat => (
                                            <button
                                                key={cat.key}
                                                onClick={() => setQuickQuizCategory(cat.key)}
                                                className="py-2.5 bg-white text-primary-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors text-sm"
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                /* Question Count Selection Step */
                                <div className="space-y-2">
                                    <p className="text-white/80 text-xs mb-1">
                                        {t('quiz.questionCount')}
                                    </p>
                                    <p className="text-white/70 text-[11px] mb-2">
                                        {stateCopy.availableQuestions}: {quickQuizAvailableCount}
                                    </p>
                                    {quickQuizAvailableCount === 0 ? (
                                        <button
                                            type="button"
                                            disabled
                                            title={stateCopy.noQuestionsTooltip}
                                            className="w-full py-2.5 bg-white/30 text-white/50 cursor-not-allowed font-semibold rounded-xl"
                                        >
                                            {t('quiz.startQuickQuiz')}
                                        </button>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2">
                                            {quizOptions.map(count => (
                                                <button
                                                    key={count}
                                                    onClick={() => startQuickQuiz(count)}
                                                    disabled={quickQuizAvailableCount < count}
                                                    className={`py-2.5 font-bold rounded-xl transition-colors ${quickQuizAvailableCount >= count
                                                        ? 'bg-white text-primary-600 hover:bg-gray-100'
                                                        : 'bg-white/30 text-white/50 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {count}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {quickQuizAvailableCount === 0 ? (
                                        <p className="text-white/80 text-xs">
                                            {stateCopy.noQuestionsAvailable}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        <div className={`${PRACTICE_MODE_CARD_CLASS} bg-gradient-to-r from-slate-700 to-slate-900`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-white/15 rounded-full">
                                    <Target className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold">{t('quiz.multipleChoice')}</p>
                                    <p className="text-white/80 text-xs">{t('quiz.multipleChoiceDesc')}</p>
                                </div>
                            </div>

                            {!showQuizOptions || quickQuizConfiguratorMode !== 'multiple-choice' ? (
                                <button
                                    onClick={() => openQuickQuizConfigurator('multiple-choice')}
                                    className={`${PRACTICE_MODE_BUTTON_CLASS} text-slate-900`}
                                >
                                    {t('quiz.startMultipleChoice')}
                                </button>
                            ) : !quickQuizCategory ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-white/80 text-xs">
                                            {t('quiz.categorySelect')}
                                        </p>
                                        {canUseProgressData && stats.totalFavorites > 0 && (
                                            <button
                                                onClick={() => {
                                                    if (!canUseFavoritesOnlyMode) {
                                                        setSubmissionError(favoritesMinimumRequiredMessage);
                                                        return;
                                                    }
                                                    setUseOnlyFavorites(!useOnlyFavorites);
                                                }}
                                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border ${useOnlyFavorites
                                                    ? 'bg-white text-red-500 border-white'
                                                    : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                                                    } ${!canUseFavoritesOnlyMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={!canUseFavoritesOnlyMode}
                                            >
                                                <Heart className={`w-2.5 h-2.5 ${useOnlyFavorites ? 'fill-current' : ''}`} />
                                                {t('quiz.favoritesOnly')}
                                            </button>
                                        )}
                                    </div>
                                    {!canUseFavoritesOnlyMode && canUseProgressData && stats.totalFavorites > 0 ? (
                                        <p className="text-white/80 text-[11px]">
                                            {favoritesMinimumRequiredMessage}
                                        </p>
                                    ) : null}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'all', label: t('quiz.categoryAll') },
                                            { key: 'Finance', label: t('categories.Finance') },
                                            { key: 'Technology', label: t('quiz.categoryTechnology') },
                                            { key: 'Fintech', label: t('categories.Fintech') },
                                        ].map(cat => (
                                            <button
                                                key={cat.key}
                                                onClick={() => setQuickQuizCategory(cat.key)}
                                                className="py-2.5 bg-white text-slate-900 font-semibold rounded-xl hover:bg-gray-100 transition-colors text-sm"
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-white/80 text-xs mb-1">
                                        {t('quiz.questionCount')}
                                    </p>
                                    <p className="text-white/70 text-[11px] mb-2">
                                        {stateCopy.availableQuestions}: {quickQuizAvailableCount}
                                    </p>
                                    {quickQuizAvailableCount < 4 ? (
                                        <button
                                            type="button"
                                            disabled
                                            title={t('quiz.multipleChoiceUnavailable')}
                                            className="w-full py-2.5 bg-white/30 text-white/50 cursor-not-allowed font-semibold rounded-xl"
                                        >
                                            {t('quiz.startMultipleChoice')}
                                        </button>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2">
                                            {quizOptions.map(count => (
                                                <button
                                                    key={count}
                                                    onClick={() => startQuickQuiz(count)}
                                                    disabled={quickQuizAvailableCount < count}
                                                    className={`py-2.5 font-bold rounded-xl transition-colors ${quickQuizAvailableCount >= count
                                                        ? 'bg-white text-slate-900 hover:bg-gray-100'
                                                        : 'bg-white/30 text-white/50 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {count}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {quickQuizAvailableCount < 4 ? (
                                        <p className="text-white/80 text-xs">
                                            {t('quiz.multipleChoiceUnavailable')}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        </div>
                        </div>

                        {/* Statistics */}
                        {canUseProgressData ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-card mb-6">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-primary-500" />
                                    {t('quiz.yourStats')}
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                                        <BookOpen className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{terms.length}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('quiz.totalWords')}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                                        <Star className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{masteredCount}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('quiz.mastered')}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                                        <Sparkles className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{learningCount}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('quiz.learning')}</p>
                                    </div>
                                    <Link
                                        href="/favorites"
                                        className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 text-center hover:ring-2 hover:ring-red-400 dark:hover:ring-red-500 hover:shadow-md transition-all cursor-pointer group"
                                    >
                                        <Heart className="w-6 h-6 text-red-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{stats.totalFavorites}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('quiz.favorites')}</p>
                                    </Link>
                                </div>
                            </div>
                        ) : null}

                        {/* Add Favorites CTA (when no favorites at all) */}
                        {canUseProgressData && stats.totalFavorites === 0 && (
                            <div className="text-center">
                                <p className="text-gray-500 text-sm mb-3">{t('quiz.orAddFavorites')}</p>
                                <Link
                                    href="/search"
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-primary-600 dark:bg-primary-400 dark:text-slate-950 dark:hover:bg-primary-300"
                                >
                                    <span>{t('quiz.exploreWords')}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }

    if (shouldShowProgressFallback && !isQuickQuiz) {
        return (
            <div className="page-content px-4 py-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('quiz.title')}</h1>
                </header>
                <DataStateCard
                    tone="error"
                    title={stateCopy.errorTitle}
                    description={stateCopy.srsUnavailableDescription}
                    action={(
                        <>
                            <button
                                onClick={refreshData}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-600"
                            >
                                <RefreshCw className="w-4 h-4" />
                                {stateCopy.retry}
                            </button>
                            <button
                                onClick={resetToNormal}
                                className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                {t('quiz.chooseMode')}
                            </button>
                        </>
                    )}
                />
            </div>
        );
    }

    // No cards due after choosing SRS or mistake review mode
    if (sessionTerms.length === 0 && !isComplete && !isQuickQuiz && hasChosenMode) {
        return (
            <div className="page-content px-4 py-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('quiz.title')}</h1>
                </header>
                <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        {isMistakeReview ? stateCopy.noMistakeReviewTitle : t('quiz.noCards')}
                    </p>
                    {isMistakeReview ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{stateCopy.noMistakeReviewDescription}</p>
                    ) : null}
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={resetToNormal}
                            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            {t('quiz.chooseMode')}
                        </button>
                        <Link
                            href="/search"
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-primary-600 dark:bg-primary-400 dark:text-slate-950 dark:hover:bg-primary-300"
                        >
                            <span>{t('quiz.exploreWords')}</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Quiz complete
    if (isComplete) {
        const accuracy = Math.round((correctCount / sessionTerms.length) * 100);

        return (
            <div className="page-content px-4 py-6">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="p-4 bg-accent-100 rounded-full mb-4 animate-pulse-soft">
                        <Trophy className="w-12 h-12 text-accent-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('quiz.complete')}
                    </h2>

                    {isQuickQuiz && (
                        <p className="text-primary-500 font-medium mb-2">{t('quiz.quickQuiz')}</p>
                    )}

                    {isMistakeReview && (
                        <p className="text-primary-500 font-medium mb-2">{stateCopy.mistakeReviewTitle}</p>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-card w-full max-w-sm mt-4 mb-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-green-500">{correctCount}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('quiz.knew')}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-red-500">{sessionTerms.length - correctCount}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('quiz.didntKnow')}</p>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-center gap-2">
                                <Sparkles className="w-5 h-5 text-accent-500" />
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">%{accuracy}</span>
                                <span className="text-gray-500 dark:text-gray-400">{t('profile.accuracy')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {isQuickQuiz ? (
                            <>
                                <button
                                    onClick={() => startQuickQuiz(5, quizPresentationMode)}
                                    className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                                >
                                    {quizPresentationMode === 'multiple-choice' ? <Target className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                                    <span>{quizPresentationMode === 'multiple-choice' ? t('quiz.multipleChoice') : t('quiz.quickQuiz')}</span>
                                </button>
                                <button
                                    onClick={resetToNormal}
                                    className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    <span>{t('common.home')}</span>
                                </button>
                            </>
                        ) : (
                            <Link
                                href={resolveHomeHref('/quiz')}
                                className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                            >
                                <span>{t('common.home')}</span>
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Active quiz
    return (
        <div className="page-content px-4 py-6">
            <script
                nonce={nonce}
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: serializeJsonLd({
                        '@context': 'https://schema.org',
                        '@type': 'Quiz',
                        name: 'FinTechTerms SRS Quiz',
                        description: 'Test your knowledge of financial and technical terms.',
                        educationalUse: 'Practice',
                        learningResourceType: 'Quiz'
                    }),
                }}
            />
            {/* Header */}
            <header className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                const confirmMsg = t('quiz.exitConfirmation');
                                if (window.confirm(confirmMsg)) {
                                    resetToNormal();
                                }
                            }}
                            className="p-1 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors mr-1"
                            aria-label={t('quiz.exitAria')}
                        >
                            <X className="w-5 h-5 border border-transparent rounded" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                            {t('quiz.title')}
                        </h1>
                        {isQuickQuiz && (
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-600 text-xs font-medium rounded-full flex items-center gap-1">
                                {quizPresentationMode === 'multiple-choice' ? <Target className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                                {quizPresentationMode === 'multiple-choice' ? t('quiz.multipleChoice') : t('quiz.quickQuiz')}
                            </span>
                        )}
                    </div>
                    <span className="text-sm text-gray-500">
                        {currentIndex + 1} / {sessionTerms.length}
                    </span>
                </div>
                <span className="sr-only" data-testid="due-card-count">
                    {dueTerms.length}
                </span>

                {/* Progress Bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="progress-bar h-full rounded-full"
                        style={{ width: `${((currentIndex) / sessionTerms.length) * 100}%` }}
                    />
                </div>
            </header>

            {submissionError ? (
                <div className="mb-4">
                    <DataStateCard
                        tone="error"
                        title={stateCopy.slowLoadingTitle}
                        description={submissionError}
                    />
                </div>
            ) : null}

            {!submissionError && isSubmissionSlow ? (
                <div className="mb-4">
                    <DataStateCard
                        tone="warning"
                        title={stateCopy.slowLoadingTitle}
                        description={stateCopy.slowLoadingDescription}
                    />
                </div>
            ) : null}

            {showSavedIndicator ? (
                <div
                    className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                    data-testid="quiz-saved-indicator"
                >
                    {t('quiz.progressSaved')}
                </div>
            ) : null}

            {currentTerm && (
                quizPresentationMode === 'multiple-choice' && currentMultipleChoiceQuestion ? (
                    <MultipleChoiceQuizCard
                        key={`${currentTerm.id}:multiple-choice`}
                        term={currentTerm}
                        options={currentMultipleChoiceQuestion.options}
                        onAnswer={handleAnswer}
                        isPending={isPending}
                    />
                ) : (
                    <QuizCard
                        key={`${currentTerm.id}:flashcard`}
                        term={currentTerm}
                        onAnswer={handleAnswer}
                        isPending={isPending}
                    />
                )
            )}

            {pausedWrongAnswer ? (
                <section className="mx-auto mt-5 w-full max-w-md rounded-3xl border border-primary-100 bg-primary-50 p-5 shadow-sm dark:border-primary-900/40 dark:bg-primary-900/20">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{aiCopy.quizFeedbackTitle}</h2>

                    {quizFeedbackStatus === 'loading' ? (
                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{aiCopy.quizFeedbackLoading}</p>
                    ) : null}

                    {quizFeedbackStatus === 'locked' ? (
                        <div className="mt-3 space-y-3">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{aiCopy.quizFeedbackGuestLimit}</p>
                            <Link
                                href={reviewUnlockHref}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-600"
                            >
                                <span>{aiCopy.quizFeedbackCta}</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    ) : null}

                    {quizFeedbackStatus === 'error' && quizFeedbackError ? (
                        <p className="mt-3 text-sm text-red-600 dark:text-red-300">{quizFeedbackError}</p>
                    ) : null}

                    {quizFeedbackStatus === 'ready' && quizFeedback ? (
                        <div className="mt-4 space-y-4 text-sm leading-6 text-gray-700 dark:text-gray-200">
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{aiCopy.whyWrong}</p>
                                <p>{quizFeedback.whyWrong}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{aiCopy.whyCorrect}</p>
                                <p>{quizFeedback.whyCorrect}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{aiCopy.memoryHook}</p>
                                <p>{quizFeedback.memoryHook}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{aiCopy.confusedWith}</p>
                                <p>{quizFeedback.confusedWith}</p>
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-5">
                        <button
                            type="button"
                            onClick={continueAfterWrongAnswer}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                            {aiCopy.quizFeedbackContinue}
                        </button>
                    </div>
                </section>
            ) : null}

            {/* Correct Streak */}
            {correctCount > 0 && (
                <div className="mt-6 flex items-center justify-center gap-2 text-green-600">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium">
                        {t('quiz.correctStreak')}: {correctCount}
                    </span>
                </div>
            )}
        </div>
    );
}
