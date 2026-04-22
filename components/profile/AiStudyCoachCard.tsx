'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { BrainCircuit } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import { getAiUiCopy } from '@/lib/ai-copy';
import { fetchStudyCoachResponse } from '@/lib/ai/client';
import type { LearningStatsActionResult } from '@/types/gamification';

const fallbackCoachNoticeByLanguage = {
    tr: 'Yedek AI çalışma koçu gösteriliyor.',
    en: 'Showing a fallback AI study coach.',
    ru: 'Показан резервный AI-план обучения.',
} as const;

interface AiStudyCoachCardProps {
    learningStats: LearningStatsActionResult;
}

export default function AiStudyCoachCard({ learningStats }: AiStudyCoachCardProps) {
    const { language } = useLanguage();
    const { terms, userProgress, stats, mistakeReviewQueue } = useSRS();
    const { entitlements, isAuthenticated, requiresProfileCompletion } = useAuth();
    const aiCopy = getAiUiCopy(language);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [coachResponse, setCoachResponse] = useState<Awaited<ReturnType<typeof fetchStudyCoachResponse>> | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const profileHref = requiresProfileCompletion ? '/profile?complete=1' : '/profile';

    const requestPayload = useMemo(() => {
        const recentQuizHistory = userProgress.quiz_history;
        const favorites = terms
            .filter((term) => userProgress.favorites.includes(term.id))
            .slice(0, 10)
            .map((term) => ({
                label: language === 'tr' ? term.term_tr : language === 'ru' ? term.term_ru : term.term_en,
                category: term.category,
            }));

        const wrongCounts = recentQuizHistory
            .filter((attempt) => !attempt.is_correct)
            .reduce<Map<string, number>>((map, attempt) => {
                map.set(attempt.term_id, (map.get(attempt.term_id) ?? 0) + 1);
                return map;
            }, new Map());

        const recentWrongTerms = Array.from(wrongCounts.entries())
            .map(([termId, wrongCount]) => {
                const term = terms.find((entry) => entry.id === termId);
                if (!term) {
                    return null;
                }

                return {
                    label: language === 'tr' ? term.term_tr : language === 'ru' ? term.term_ru : term.term_en,
                    category: String(term.category),
                    wrongCount,
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
            .slice(0, 8);

        return {
            language,
            favorites,
            recentWrongTerms,
            dueToday: stats.dueToday,
            accuracy: learningStats.ok ? learningStats.data.accuracy : null,
            currentStreak: userProgress.current_streak,
            mistakeQueueCount: mistakeReviewQueue.length,
        };
    }, [language, learningStats, mistakeReviewQueue.length, stats.dueToday, terms, userProgress.current_streak, userProgress.favorites, userProgress.quiz_history]);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setNotice(null);

        try {
            const response = await fetchStudyCoachResponse(requestPayload);
            setCoachResponse(response);
            setNotice(response.degraded || response.usedFallback
                ? fallbackCoachNoticeByLanguage[language] ?? fallbackCoachNoticeByLanguage.en
                : null);
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : aiCopy.genericError);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAuthenticated || !entitlements.canUseAiFeatures) {
        return (
            <section className="relative overflow-hidden rounded-3xl border border-primary-100/50 bg-gradient-to-br from-primary-50/80 to-white/90 p-6 shadow-md backdrop-blur-md dark:border-primary-900/30 dark:from-slate-800/90 dark:to-slate-900/90">
                {/* Subtle background glow effect */}
                <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary-400/10 blur-3xl dark:bg-primary-500/10 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-100/60 text-primary-600 shadow-sm dark:bg-primary-900/40 dark:text-primary-400">
                        <BrainCircuit className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {aiCopy.studyCoachTitle}
                        </h3>
                        <p className="mt-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                            {!isAuthenticated
                                ? aiCopy.studyCoachGuest
                                : requiresProfileCompletion
                                ? aiCopy.studyCoachCompleteProfile
                                : aiCopy.studyCoachGuest}
                        </p>
                    </div>
                    <Link
                        href={profileHref}
                        className="mt-4 sm:mt-0 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-105 hover:bg-slate-800 hover:shadow-lg dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400 dark:hover:shadow-primary-500/25"
                    >
                        {aiCopy.quizFeedbackCta}
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700/60 dark:bg-slate-800/80 backdrop-blur-md">
            {/* Ambient background glow */}
            <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary-400/5 blur-3xl dark:bg-primary-500/5 pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 shadow-sm dark:bg-primary-900/30 dark:text-primary-400">
                        <BrainCircuit className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {aiCopy.studyCoachTitle}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                            {aiCopy.studyCoachDescription}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={isLoading}
                    className="shrink-0 rounded-xl bg-primary-500 px-6 py-3 font-semibold text-white shadow-md transition-all hover:scale-105 hover:bg-primary-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 disabled:hover:shadow-md"
                >
                    {isLoading ? (
                        <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                            {aiCopy.studyCoachLoading}
                        </span>
                    ) : (
                        aiCopy.studyCoachAction
                    )}
                </button>
            </div>

            {error ? (
                <div className="relative z-10 mt-5 rounded-2xl border border-red-100 bg-red-50/80 p-4 text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                </div>
            ) : null}

            {notice ? (
                <div className="relative z-10 mt-5 rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                    {notice}
                </div>
            ) : null}

            {coachResponse ? (
                <div className="relative z-10 mt-6 space-y-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-[15px] leading-relaxed text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/30 dark:text-slate-200">
                    <div>
                        <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-500"></span>
                            {aiCopy.studyCoachFocusAreas}
                        </p>
                        <ul className="mt-3 flex flex-wrap gap-2">
                            {coachResponse.coach.focusAreas.map((item) => (
                                <li key={item} className="rounded-lg border border-slate-200/60 bg-white/60 px-3 py-1.5 text-sm font-medium shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-500"></span>
                            {aiCopy.studyCoachPlan}
                        </p>
                        <ul className="mt-3 flex flex-wrap gap-2">
                            {coachResponse.coach.todayPlan.map((item) => (
                                <li key={item} className="rounded-lg border border-slate-200/60 bg-white/60 px-3 py-1.5 text-sm font-medium shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="rounded-xl bg-white/50 p-4 dark:bg-slate-800/40">
                        <p className="font-bold text-slate-900 dark:text-white">{aiCopy.studyCoachReason}</p>
                        <p className="mt-1">{coachResponse.coach.reason}</p>
                    </div>
                    <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4 dark:border-primary-900/30 dark:bg-primary-900/10">
                        <p className="font-bold text-primary-900 dark:text-primary-300">{aiCopy.studyCoachNote}</p>
                        <p className="mt-1 text-primary-800 dark:text-primary-200/90">{coachResponse.coach.encouragement}</p>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
