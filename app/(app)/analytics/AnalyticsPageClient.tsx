'use client';

import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { getTranslationValue } from '@/lib/i18n';
import { getLearningStatsPartialNotice } from '@/lib/learning-stats-ui';
import type { LearningStatsActionResult } from '@/types/gamification';
import {
    BarChart3,
    TrendingUp,
    Clock,
    Target,
    Brain,
    BookOpen,
    Award,
    Calendar,
    ArrowLeft,
    Download,
} from 'lucide-react';

interface CategoryStats {
    name: string;
    count: number;
    avgDifficulty: number;
    avgRetention: number;
    reviewed: number;
    color: string;
}

interface SRSLevelStats {
    level: number;
    count: number;
    label: string;
}

interface AnalyticsCopy {
    title: string;
    subtitle: string;
    back: string;
    overview: string;
    totalTerms: string;
    favorites: string;
    reviewed: string;
    mastered: string;
    categoryAnalysis: string;
    terms: string;
    difficulty: string;
    retention: string;
    srsDistribution: string;
    box: string;
    learningProgress: string;
    streak: string;
    days: string;
    accuracy: string;
    totalReviews: string;
    avgResponseTime: string;
    recentActivity: string;
    noActivity: string;
    correct: string;
    wrong: string;
    exportData: string;
    forResearch: string;
    unknownTerm: string;
    srsLevels: string[];
}

interface AnalyticsPageClientProps {
    learningStats: LearningStatsActionResult;
}

const teaserCopyByLanguage = {
    en: {
        sessionAttempts: 'This session attempts',
        sessionAccuracy: 'This session accuracy',
        title: 'Unlock full member analytics',
        guestDescription: 'Create an account to sync progress, export history, and unlock the full learning dashboard.',
        memberDescription: 'Complete your profile to unlock full member analytics, exports, and review insights.',
        cta: 'Open Profile',
    },
    tr: {
        sessionAttempts: 'Bu oturum denemeleri',
        sessionAccuracy: 'Bu oturum doğruluğu',
        title: 'Tam üye analitiğinin kilidini aç',
        guestDescription: 'İlerlemeni senkronize etmek, geçmişi dışa aktarmak ve tam öğrenme panelini açmak için hesap oluştur.',
        memberDescription: 'Tam üye analitiği, dışa aktarma ve tekrar içgörüleri için profilini tamamla.',
        cta: 'Profili Aç',
    },
    ru: {
        sessionAttempts: 'Попытки в этой сессии',
        sessionAccuracy: 'Точность в этой сессии',
        title: 'Откройте полную аналитику участника',
        guestDescription: 'Создайте аккаунт, чтобы синхронизировать прогресс, экспортировать историю и открыть полный учебный дашборд.',
        memberDescription: 'Заполните профиль, чтобы открыть полную аналитику, экспорт и review-инсайты.',
        cta: 'Открыть профиль',
    },
} as const;

const ANALYTICS_EXPORT_TIMEOUT_MS = 10_000;

const downloadBlob = (filename: string, blob: Blob): void => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};

export default function AnalyticsPageClient({ learningStats }: AnalyticsPageClientProps) {
    const { language, t: translate } = useLanguage();
    const { terms, userProgress, stats, quizPreview } = useSRS();
    const { entitlements, isAuthenticated, requiresProfileCompletion } = useAuth();
    const copy = getTranslationValue(language, 'analytics') as AnalyticsCopy;
    const teaserCopy = teaserCopyByLanguage[language] ?? teaserCopyByLanguage.en;
    const isAdvancedAnalyticsEnabled = entitlements.canUseAdvancedAnalytics;
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const learningStatsMissingSegments = learningStats.ok ? (learningStats.missing ?? []) : [];
    const partialLearningStatsNotice = learningStats.ok && (learningStats.degraded ?? false)
        ? getLearningStatsPartialNotice(language, learningStatsMissingSegments)
        : null;
    const favoriteTerms = useMemo(
        () => terms.filter((term) => userProgress.favorites.includes(term.id)),
        [terms, userProgress.favorites]
    );

    const categoryStats = useMemo((): CategoryStats[] => {
        const categoryConfig: Array<{ key: 'Fintech' | 'Finance' | 'Technology'; color: string }> = [
            { key: 'Fintech', color: '#8b5cf6' },
            { key: 'Finance', color: '#10b981' },
            { key: 'Technology', color: '#475569' },
        ];

        return categoryConfig.map(({ key: cat, color }) => {
            const catTerms = favoriteTerms.filter((term) => term.category === cat);
            const reviewed = catTerms.filter((term) => term.times_reviewed > 0);
            const avgDifficulty = catTerms.length > 0
                ? catTerms.reduce((sum, term) => sum + term.difficulty_score, 0) / catTerms.length
                : 0;
            const avgRetention = reviewed.length > 0
                ? reviewed.reduce((sum, term) => sum + term.retention_rate, 0) / reviewed.length
                : 0;

            return {
                name: translate(`categories.${cat}`),
                count: catTerms.length,
                avgDifficulty: Math.round(avgDifficulty * 10) / 10,
                avgRetention: Math.round(avgRetention * 100),
                reviewed: reviewed.length,
                color,
            };
        });
    }, [favoriteTerms, translate]);

    const srsDistribution = useMemo((): SRSLevelStats[] => {
        const srsLevelLabels = copy.srsLevels;

        return [1, 2, 3, 4, 5].map((level) => ({
            level,
            count: favoriteTerms.filter((term) => term.srs_level === level).length,
            label: srsLevelLabels[level - 1] || `Level ${level}`,
        }));
    }, [copy.srsLevels, favoriteTerms]);
    const maxSrsCount = useMemo(
        () => Math.max(...srsDistribution.map((entry) => entry.count), 1),
        [srsDistribution]
    );

    const quizStats = useMemo(() => {
        if (isAdvancedAnalyticsEnabled && isAuthenticated) {
            if (!learningStats.ok) {
                return {
                    correct: null as number | null,
                    total: null as number | null,
                    accuracy: null as number | null,
                    avgResponseTime: null as number | null,
                };
            }

            return {
                correct: learningStats.data.correctReviews,
                total: learningStats.data.totalReviews,
                accuracy: learningStats.data.accuracy,
                avgResponseTime: learningStats.data.avgResponseTimeMs,
            };
        }

        const total = quizPreview.attemptCount;
        const correct = quizPreview.correctCount;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        const avgResponseTime = quizPreview.avgResponseTimeMs ?? 0;

        return { correct, total, accuracy, avgResponseTime };
    }, [isAdvancedAnalyticsEnabled, isAuthenticated, learningStats, quizPreview]);

    const recentActivity = useMemo(() => {
        const recentAttempts = (() => {
            if (isAdvancedAnalyticsEnabled && isAuthenticated) {
                return learningStats.ok ? learningStats.data.recentAttempts : [];
            }

            return [];
        })();

        return recentAttempts.map((attempt) => {
            const term = terms.find((entry) => entry.id === attempt.termId);
            const termNameByLanguage = term
                ? {
                    tr: term.term_tr,
                    ru: term.term_ru,
                    en: term.term_en,
                }
                : null;

            return {
                ...attempt,
                termName: termNameByLanguage?.[language] ?? copy.unknownTerm,
            };
        });
    }, [copy.unknownTerm, isAdvancedAnalyticsEnabled, isAuthenticated, language, learningStats, terms]);

    const handleExport = async () => {
        if (!isAdvancedAnalyticsEnabled || !isAuthenticated) {
            return;
        }

        setIsExporting(true);
        setExportError(null);

        try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => {
                controller.abort();
            }, ANALYTICS_EXPORT_TIMEOUT_MS);
            let response: Response;

            try {
                response = await fetch('/api/analytics/export?download=1', {
                    method: 'GET',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    signal: controller.signal,
                });
            } finally {
                window.clearTimeout(timeoutId);
            }

            if (!response.ok) {
                const payload = await response.json();
                throw new Error(
                    typeof payload?.message === 'string'
                        ? payload.message
                        : 'Unable to export analytics data.'
                );
            }

            const blob = await response.blob();
            downloadBlob(
                `fintechterms-analytics-${new Date().toISOString().split('T')[0]}.json`,
                blob
            );
        } catch (error) {
            setExportError(
                error instanceof Error && error.name === 'AbortError'
                    ? 'Analytics export timed out. Please try again.'
                    : error instanceof Error
                        ? error.message
                        : 'Unable to export analytics data.'
            );
        } finally {
            setIsExporting(false);
        }
    };

    const formatMetric = (value: number | null, formatter?: (nextValue: number) => string): string => {
        if (value === null) {
            return '—';
        }

        return formatter ? formatter(value) : String(value);
    };

    const srsColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

    return (
        <div className="page-content px-4 py-6">
            <Link
                href="/profile"
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                {copy.back}
            </Link>

            <header className="text-center mb-6">
                <div className="inline-flex items-center justify-center p-3 bg-primary-100 dark:bg-primary-900/30 rounded-2xl mb-3">
                    <BarChart3 className="w-8 h-8 text-primary-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{copy.title}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{copy.subtitle}</p>
            </header>

            {isAdvancedAnalyticsEnabled && isAuthenticated && partialLearningStatsNotice ? (
                <section className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                    <p className="font-semibold">{partialLearningStatsNotice.title}</p>
                    <p className="mt-2 leading-6">{partialLearningStatsNotice.description}</p>
                </section>
            ) : null}

            {!isAdvancedAnalyticsEnabled ? (
                <>
                    <section className="mb-6">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                            {copy.overview}
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                                <BookOpen className="w-5 h-5 text-blue-500 mb-2" />
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{quizPreview.attemptCount}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{teaserCopy.sessionAttempts}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                                <TrendingUp className="w-5 h-5 text-purple-500 mb-2" />
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {quizPreview.attemptCount > 0 ? `%${quizStats.accuracy ?? 0}` : '—'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{teaserCopy.sessionAccuracy}</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-primary-100 bg-primary-50 p-6 text-center dark:border-primary-900/40 dark:bg-primary-900/20">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{teaserCopy.title}</h2>
                        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                            {requiresProfileCompletion ? teaserCopy.memberDescription : teaserCopy.guestDescription}
                        </p>
                        <Link
                            href={requiresProfileCompletion ? '/profile?complete=1' : '/profile'}
                            className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-600"
                        >
                            {teaserCopy.cta}
                        </Link>
                    </section>
                </>
            ) : (
                <>

            <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {copy.overview}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <BookOpen className="w-5 h-5 text-blue-500 mb-2" />
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{terms.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{copy.totalTerms}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <Award className="w-5 h-5 text-red-500 mb-2" />
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalFavorites}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{copy.favorites}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <Target className="w-5 h-5 text-green-500 mb-2" />
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.mastered}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{copy.mastered}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <TrendingUp className="w-5 h-5 text-purple-500 mb-2" />
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatMetric(quizStats.accuracy, (value) => `%${value}`)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{copy.accuracy}</p>
                    </div>
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {copy.categoryAnalysis}
                </h2>
                <div className="space-y-3">
                    {categoryStats.map((category) => (
                        <div key={category.name} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: category.color }}
                                    />
                                    <span className="font-semibold text-gray-900 dark:text-white">{category.name}</span>
                                </div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">{category.count} {copy.terms}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">{copy.difficulty}:</span>
                                    <span className="ml-2 font-medium dark:text-gray-200">{category.avgDifficulty}/5</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">{copy.retention}:</span>
                                    <span className="ml-2 font-medium dark:text-gray-200">{category.avgRetention}%</span>
                                </div>
                            </div>
                            <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${category.count > 0 ? (category.reviewed / category.count) * 100 : 0}%`,
                                        backgroundColor: category.color,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {copy.srsDistribution}
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        {srsDistribution.map((level, index) => {
                            const widthPercentage = level.count > 0
                                ? Math.max(Math.round((level.count / maxSrsCount) * 100), 16)
                                : 0;

                            return (
                                <article
                                    key={level.level}
                                    className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-slate-900/40"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                                            {copy.box} {level.level}
                                        </span>
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {level.count}
                                        </span>
                                    </div>
                                    <span className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                        {level.label}
                                    </span>
                                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${widthPercentage}%`,
                                                backgroundColor: srsColors[index],
                                            }}
                                        />
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {copy.learningProgress}
                </h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-4 text-white">
                        <Calendar className="w-5 h-5 mb-2 opacity-80" />
                        <p className="text-2xl font-bold">{formatMetric(
                            isAuthenticated
                                ? (learningStats.ok ? learningStats.data.currentStreak : null)
                                : userProgress.current_streak
                        )}</p>
                        <p className="text-xs text-white/80">{copy.streak} ({copy.days})</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl p-4 text-white">
                        <Brain className="w-5 h-5 mb-2 opacity-80" />
                        <p className="text-2xl font-bold">{formatMetric(quizStats.total)}</p>
                        <p className="text-xs text-white/80">{copy.totalReviews}</p>
                    </div>
                    <div className="bg-gradient-to-br from-sky-500 to-cyan-500 rounded-xl p-4 text-white">
                        <Clock className="w-5 h-5 mb-2 opacity-80" />
                        <p className="text-2xl font-bold">
                            {formatMetric(quizStats.avgResponseTime, (value) => `${value}ms`)}
                        </p>
                        <p className="text-xs text-white/80">{copy.avgResponseTime}</p>
                    </div>
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {copy.recentActivity}
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {recentActivity.length > 0 ? (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {recentActivity.map((activity) => (
                                <div key={activity.id} className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${activity.isCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                                            {activity.termName}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-medium ${activity.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                        {activity.isCorrect ? copy.correct : copy.wrong}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                            {copy.noActivity}
                        </div>
                    )}
                </div>
            </section>

            <section>
                <button
                    onClick={handleExport}
                    disabled={!isAuthenticated || isExporting}
                    className={`w-full flex items-center justify-center gap-3 p-4 font-semibold rounded-xl transition-colors ${!isAuthenticated || isExporting
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                        }`}
                >
                    <Download className="w-5 h-5" />
                    <div className="text-left">
                        <p>{copy.exportData}</p>
                        <p className={`${!isAuthenticated || isExporting ? 'text-gray-500 dark:text-gray-500' : 'text-white/70'} text-xs`}>
                            {copy.forResearch}
                        </p>
                    </div>
                </button>
                {exportError ? (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">{exportError}</p>
                ) : null}
            </section>
                </>
            )}
        </div>
    );
}
