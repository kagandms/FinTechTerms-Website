'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import QuizCard from '@/components/QuizCard';
import DataStateCard from '@/components/DataStateCard';
import Link from 'next/link';
import { Trophy, ArrowRight, Heart, Sparkles, Flame, Zap, BookOpen, Star, Target, X, Loader2, RefreshCw } from 'lucide-react';

import { incrementQuizAttempt } from '@/components/SessionTracker';
import { createIdempotencyKey } from '@/lib/idempotency';

const QUIZ_SUBMISSION_TIMEOUT_MS = 10_000;
const QUIZ_SUBMISSION_TIMEOUT_MESSAGE = 'Loading is taking too long — please try again';

const withQuizSubmissionTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = globalThis.setTimeout(() => {
            reject(new Error(QUIZ_SUBMISSION_TIMEOUT_MESSAGE));
        }, QUIZ_SUBMISSION_TIMEOUT_MS);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId !== undefined) {
            globalThis.clearTimeout(timeoutId);
        }
    }
};

const stateMessages = {
    tr: {
        loadingTitle: 'Quiz yukleniyor',
        loadingDescription: 'Calisma verileri hazirlaniyor. Lutfen bekleyin.',
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
    },
    en: {
        loadingTitle: 'Loading quiz',
        loadingDescription: 'Study data is being prepared. Please wait.',
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
    },
    ru: {
        loadingTitle: 'Загружаем квиз',
        loadingDescription: 'Подготавливаем учебные данные. Пожалуйста, подождите.',
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
    },
} as const;

export default function QuizPage() {
    const { t, language } = useLanguage();
    const {
        dueTerms,
        submitQuizAnswer,
        stats,
        terms,
        userProgress,
        isLoading,
        termsStatus,
        progressStatus,
        refreshData,
    } = useSRS();
    const stateCopy = stateMessages[language] ?? stateMessages.en;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [sessionTerms, setSessionTerms] = useState<typeof dueTerms>([]);
    const [isQuickQuiz, setIsQuickQuiz] = useState(false);
    const [showQuizOptions, setShowQuizOptions] = useState(false);
    const [hasChosenMode, setHasChosenMode] = useState(false);
    const [quickQuizCategory, setQuickQuizCategory] = useState<string | null>(null);
    const [useOnlyFavorites, setUseOnlyFavorites] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
    const [showSavedIndicator, setShowSavedIndicator] = useState(false);

    // Prevents dynamic shrinking of sessionTerms when dueTerms completes during a session
    const [hasStartedNormalQuiz, setHasStartedNormalQuiz] = useState(false);

    const quizOptions = [5, 10, 20, 50];
    const masteredCount = terms.filter(t => t.srs_level >= 4).length;
    const learningCount = terms.filter(t => t.srs_level > 0 && t.srs_level < 4).length;
    const hasBlockingTermsError = termsStatus === 'error' || (termsStatus === 'degraded' && terms.length === 0);
    const hasCachedProgressData = dueTerms.length > 0
        || userProgress.favorites.length > 0
        || userProgress.quiz_history.length > 0
        || userProgress.current_streak > 0;
    const canUseProgressData = progressStatus === 'ready' || (progressStatus === 'degraded' && hasCachedProgressData);
    const shouldShowProgressFallback = progressStatus === 'error' || (progressStatus === 'degraded' && !hasCachedProgressData);
    const shouldShowDegradedNotice = (termsStatus === 'degraded' && terms.length > 0)
        || (progressStatus === 'degraded' && hasCachedProgressData);

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

    // Initialize session terms only AFTER user has chosen SRS mode
    useEffect(() => {
        if (!isQuickQuiz && hasChosenMode && !hasStartedNormalQuiz && dueTerms.length > 0) {
            setSessionTerms(dueTerms);
            setHasStartedNormalQuiz(true);
        } else if (!isQuickQuiz && hasChosenMode && !hasStartedNormalQuiz && dueTerms.length === 0) {
            setSessionTerms([]);
        }
    }, [dueTerms, isQuickQuiz, hasStartedNormalQuiz, hasChosenMode]);

    const currentTerm = sessionTerms[currentIndex];

    useEffect(() => {
        if (!currentTerm || isQuickQuiz) {
            setCurrentReviewId(null);
            return;
        }

        setCurrentReviewId(createIdempotencyKey());
    }, [currentIndex, currentTerm, isQuickQuiz]);

    // Start quick quiz with selected word count and category
    const startQuickQuiz = (count: number) => {
        const pool = getQuickQuizPool(quickQuizCategory);
        const shuffled = pool.sort(() => Math.random() - 0.5);
        const quizTerms = shuffled.slice(0, Math.min(count, pool.length));
        setSessionTerms(quizTerms);
        setCurrentIndex(0);
        setCorrectCount(0);
        setIsComplete(false);
        setIsQuickQuiz(true);
        setShowQuizOptions(false);
        setQuickQuizCategory(null);
        setSubmissionError(null);
    };

    const handleAnswer = async (isCorrect: boolean, responseTimeMs: number) => {
        if (!currentTerm || isPending) return;

        setIsPending(true);
        setSubmissionError(null);

        try {
            // Increment session counter
            incrementQuizAttempt();

            // Submit to SRS system (only for actual favorites, not quick quiz)
            if (!isQuickQuiz) {
                await withQuizSubmissionTimeout(
                    submitQuizAnswer(
                        currentTerm.id,
                        isCorrect,
                        responseTimeMs,
                        currentReviewId ?? createIdempotencyKey()
                    )
                );
                setShowSavedIndicator(true);
            }

            if (isCorrect) {
                setCorrectCount(c => c + 1);
            }

            // Move to next or complete
            if (currentIndex + 1 >= sessionTerms.length) {
                setIsComplete(true);
            } else {
                setCurrentIndex(i => i + 1);
            }
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : stateCopy.slowLoadingDescription);
        } finally {
            setIsPending(false);
        }
    };

    // Reset to mode selection
    const resetToNormal = () => {
        setIsQuickQuiz(false);
        setHasStartedNormalQuiz(false);
        setHasChosenMode(false);
        setSessionTerms([]);
        setCurrentIndex(0);
        setCorrectCount(0);
        setIsComplete(false);
        setShowQuizOptions(false);
        setQuickQuizCategory(null);
        setUseOnlyFavorites(false);
        setSubmissionError(null);
        setCurrentReviewId(null);
        setShowSavedIndicator(false);
    };

    // Start SRS review mode
    const startSrsReview = () => {
        setHasChosenMode(true);
        setIsQuickQuiz(false);
    };

    // Mode Selection Screen — show when user hasn't chosen a mode yet
    if (!hasChosenMode && !isQuickQuiz) {
        return (
            <div className="page-content px-4 py-6">
                {/* Header */}
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('quiz.title')}</h1>
                    {!isLoading && canUseProgressData && dueTerms.length > 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('quiz.chooseMode')}</p>
                    )}
                    <span className="sr-only" data-testid="due-card-count">
                        {dueTerms.length}
                    </span>
                </header>

                {isLoading ? (
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

                        {/* Daily Streak Card - Compact */}
                        {canUseProgressData ? (
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-3 text-white mb-4 shadow-md">
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
                        ) : (
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

                        {/* SRS Review Card — only when dueTerms exist */}
                        {canUseProgressData && dueTerms.length > 0 && (
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-5 text-white mb-4 shadow-lg">
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
                                    className="w-full mt-3 py-2.5 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    {t('quiz.startSrsReview')}
                                </button>
                            </div>
                        )}

                        {/* Quick Quiz Card */}
                        <div className="bg-gradient-to-r from-primary-500 to-blue-500 rounded-2xl p-5 text-white mb-4 shadow-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-white/20 rounded-full">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold">{t('quiz.quickQuiz')}</p>
                                    <p className="text-white/80 text-xs">{t('quiz.quickQuizDesc')}</p>
                                </div>
                            </div>

                            {!showQuizOptions ? (
                                <button
                                    onClick={() => setShowQuizOptions(true)}
                                    className="w-full py-2.5 bg-white text-primary-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    {t('quiz.startQuickQuiz')}
                                </button>
                            ) : !quickQuizCategory ? (
                                /* Category Selection Step */
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-white/80 text-xs">
                                            {language === 'tr' ? 'Kategori Seçin:' : language === 'ru' ? 'Выберите категорию:' : 'Choose Category:'}
                                        </p>
                                        {canUseProgressData && stats.totalFavorites > 0 && (
                                            <button
                                                onClick={() => setUseOnlyFavorites(!useOnlyFavorites)}
                                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border ${useOnlyFavorites
                                                    ? 'bg-white text-red-500 border-white'
                                                    : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                                                    }`}
                                            >
                                                <Heart className={`w-2.5 h-2.5 ${useOnlyFavorites ? 'fill-current' : ''}`} />
                                                {language === 'tr' ? 'Sadece Favoriler' : language === 'ru' ? 'Только избранные' : 'Favorites Only'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'all', label: language === 'tr' ? 'Hepsi' : language === 'ru' ? 'Все' : 'All' },
                                            { key: 'Finance', label: language === 'tr' ? 'Finans' : language === 'ru' ? 'Финансы' : 'Finance' },
                                            { key: 'Technology', label: language === 'tr' ? 'Yazılım' : language === 'ru' ? 'Программное обеспечение' : 'Software' },
                                            { key: 'Fintech', label: language === 'tr' ? 'Fintek' : language === 'ru' ? 'Финтех' : 'FinTech' },
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
                                        {language === 'tr' ? 'Soru Sayısı:' : language === 'ru' ? 'Количество вопросов:' : 'Number of Questions:'}
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
                                    <Link href="/favorites" className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 text-center hover:ring-2 hover:ring-red-400 dark:hover:ring-red-500 hover:shadow-md transition-all cursor-pointer group">
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
                                    className="inline-flex items-center gap-2 text-primary-500 font-medium hover:underline"
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

    // No cards due after choosing SRS mode
    if (sessionTerms.length === 0 && !isComplete && !isQuickQuiz && hasChosenMode) {
        return (
            <div className="page-content px-4 py-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('quiz.title')}</h1>
                </header>
                <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">{t('quiz.noCards')}</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={resetToNormal}
                            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            {t('quiz.chooseMode')}
                        </button>
                        <Link
                            href="/search"
                            className="inline-flex items-center gap-2 text-primary-500 font-medium hover:underline px-6 py-3"
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
                                    onClick={() => startQuickQuiz(5)}
                                    className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                                >
                                    <Zap className="w-5 h-5" />
                                    <span>{t('quiz.quickQuiz')}</span>
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
                                href="/"
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
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
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
                                const confirmMsg = language === 'tr' ? 'Testi bitirip çıkmak istediğinize emin misiniz?' : language === 'ru' ? 'Вы уверены, что хотите завершить тест и выйти?' : 'Are you sure you want to exit the quiz?';
                                if (window.confirm(confirmMsg)) {
                                    resetToNormal();
                                }
                            }}
                            className="p-1 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors mr-1"
                            aria-label="Exit quiz"
                        >
                            <X className="w-5 h-5 border border-transparent rounded" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                            {t('quiz.title')}
                        </h1>
                        {isQuickQuiz && (
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-600 text-xs font-medium rounded-full flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                {t('quiz.quickQuiz')}
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

            {showSavedIndicator ? (
                <div
                    className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                    data-testid="quiz-saved-indicator"
                >
                    {language === 'tr'
                        ? 'Ilerleme kaydedildi.'
                        : language === 'ru'
                            ? 'Прогресс сохранен.'
                            : 'Progress saved.'}
                </div>
            ) : null}

            {currentTerm && (
                <QuizCard
                    key={currentTerm.id}
                    term={currentTerm}
                    onAnswer={handleAnswer}
                    isPending={isPending}
                />
            )}

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
