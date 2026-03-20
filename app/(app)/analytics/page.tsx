'use client';

import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import Link from 'next/link';
import { getTranslationValue } from '@/lib/i18n';
import {
    BarChart3,
    TrendingUp,
    Clock,
    Target,
    Brain,
    Layers,
    BookOpen,
    Award,
    Calendar,
    ArrowLeft,
    Download,
    PieChart,
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

export default function AnalyticsPage() {
    const { language, t: translate } = useLanguage();
    const { terms, userProgress, stats } = useSRS();
    const copy = getTranslationValue(language, 'analytics') as AnalyticsCopy;

    // Calculate category statistics
    const categoryStats = useMemo((): CategoryStats[] => {
        const categoryConfig: Array<{ key: 'Fintech' | 'Finance' | 'Technology'; color: string }> = [
            { key: 'Fintech', color: '#8b5cf6' },
            { key: 'Finance', color: '#10b981' },
            { key: 'Technology', color: '#475569' },
        ];

        return categoryConfig.map(({ key: cat, color }) => {
            const catTerms = terms.filter(term => term.category === cat);
            const reviewed = catTerms.filter(term => term.times_reviewed > 0);
            const avgDifficulty = catTerms.length > 0
                ? catTerms.reduce((sum, t) => sum + t.difficulty_score, 0) / catTerms.length
                : 0;
            const avgRetention = reviewed.length > 0
                ? reviewed.reduce((sum, t) => sum + t.retention_rate, 0) / reviewed.length
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
    }, [terms, translate]);

    // Calculate SRS level distribution
    const srsDistribution = useMemo((): SRSLevelStats[] => {
        const favoriteTerms = terms.filter(term => userProgress.favorites.includes(term.id));
        const srsLevelLabels = copy.srsLevels;

        return [1, 2, 3, 4, 5].map(level => ({
            level,
            count: favoriteTerms.filter(t => t.srs_level === level).length,
            label: srsLevelLabels[level - 1] || `Level ${level}`,
        }));
    }, [copy.srsLevels, terms, userProgress.favorites]);

    // Calculate quiz statistics
    const quizStats = useMemo(() => {
        const history = userProgress.quiz_history;
        const correct = history.filter(q => q.is_correct).length;
        const total = history.length;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        const avgResponseTime = total > 0
            ? Math.round(history.reduce((sum, q) => sum + q.response_time_ms, 0) / total)
            : 0;

        return { correct, total, accuracy, avgResponseTime };
    }, [userProgress.quiz_history]);

    // Recent activity (last 10)
    const recentActivity = useMemo(() => {
        return [...userProgress.quiz_history]
            .sort((left, right) => (
                new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
            ))
            .slice(0, 10)
            .map(attempt => {
                const term = terms.find(t => t.id === attempt.term_id);
                return {
                    ...attempt,
                    termName: term ? (language === 'tr' ? term.term_tr : language === 'ru' ? term.term_ru : term.term_en) : copy.unknownTerm,
                };
            });
    }, [copy.unknownTerm, userProgress.quiz_history, terms, language]);

    // Export data as JSON
    const handleExport = () => {
        const exportData = {
            exportDate: new Date().toISOString(),
            summary: {
                totalTerms: terms.length,
                favorites: userProgress.favorites.length,
                totalReviews: quizStats.total,
                accuracy: quizStats.accuracy,
                currentStreak: userProgress.current_streak,
            },
            categoryStats,
            srsDistribution,
            quizHistory: userProgress.quiz_history,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fintechterms-analytics-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const srsColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

    return (
        <div className="page-content px-4 py-6">
            {/* Back Button */}
            <Link
                href="/profile"
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                {copy.back}
            </Link>

            {/* Header */}
            <header className="text-center mb-6">
                <div className="inline-flex items-center justify-center p-3 bg-primary-100 dark:bg-primary-900/30 rounded-2xl mb-3">
                    <BarChart3 className="w-8 h-8 text-primary-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{copy.title}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{copy.subtitle}</p>
            </header>

            {/* Overview Cards */}
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
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">%{quizStats.accuracy}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{copy.accuracy}</p>
                    </div>
                </div>
            </section>

            {/* Category Analysis */}
            <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {copy.categoryAnalysis}
                </h2>
                <div className="space-y-3">
                    {categoryStats.map((cat) => (
                        <div key={cat.name} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: cat.color }}
                                    />
                                    <span className="font-semibold text-gray-900 dark:text-white">{cat.name}</span>
                                </div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">{cat.count} {copy.terms}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">{copy.difficulty}:</span>
                                    <span className="ml-2 font-medium dark:text-gray-200">{cat.avgDifficulty}/5</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">{copy.retention}:</span>
                                    <span className="ml-2 font-medium dark:text-gray-200">{cat.avgRetention}%</span>
                                </div>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${(cat.reviewed / cat.count) * 100}%`,
                                        backgroundColor: cat.color,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* SRS Distribution */}
            <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {copy.srsDistribution}
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-end justify-between h-32 gap-2">
                        {srsDistribution.map((level, i) => {
                            const maxCount = Math.max(...srsDistribution.map(l => l.count), 1);
                            const height = (level.count / maxCount) * 100;
                            return (
                                <div key={level.level} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{level.count}</span>
                                    <div
                                        className="w-full rounded-t-lg transition-all"
                                        style={{
                                            height: `${Math.max(height, 4)}%`,
                                            backgroundColor: srsColors[i],
                                        }}
                                    />
                                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center leading-tight">
                                        {level.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Learning Progress */}
            <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {copy.learningProgress}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-4 text-white">
                        <Calendar className="w-5 h-5 mb-2 opacity-80" />
                        <p className="text-2xl font-bold">{userProgress.current_streak}</p>
                        <p className="text-xs text-white/80">{copy.streak} ({copy.days})</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl p-4 text-white">
                        <Brain className="w-5 h-5 mb-2 opacity-80" />
                        <p className="text-2xl font-bold">{quizStats.total}</p>
                        <p className="text-xs text-white/80">{copy.totalReviews}</p>
                    </div>
                </div>
            </section>

            {/* Recent Activity */}
            <section className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {copy.recentActivity}
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {recentActivity.length > 0 ? (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {recentActivity.map((activity, i) => (
                                <div key={i} className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${activity.is_correct ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                                            {activity.termName}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-medium ${activity.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                                        {activity.is_correct ? copy.correct : copy.wrong}
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

            {/* Export Data */}
            <section>
                <button
                    onClick={handleExport}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                >
                    <Download className="w-5 h-5" />
                    <div className="text-left">
                        <p>{copy.exportData}</p>
                        <p className="text-xs text-white/70">{copy.forResearch}</p>
                    </div>
                </button>
            </section>
        </div>
    );
}
