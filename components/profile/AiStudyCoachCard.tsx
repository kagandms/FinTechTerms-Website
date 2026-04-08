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
        const favorites = terms
            .filter((term) => userProgress.favorites.includes(term.id))
            .slice(0, 10)
            .map((term) => ({
                label: language === 'tr' ? term.term_tr : language === 'ru' ? term.term_ru : term.term_en,
                category: term.category,
            }));

        const wrongCounts = userProgress.quiz_history
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
            <section className="rounded-3xl border border-primary-100 bg-primary-50 p-5 shadow-sm dark:border-primary-900/40 dark:bg-primary-900/20">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-primary-500/10 p-3 text-primary-600 dark:text-primary-300">
                        <BrainCircuit className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{aiCopy.studyCoachTitle}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {!isAuthenticated
                                ? aiCopy.studyCoachGuest
                                : requiresProfileCompletion
                                ? aiCopy.studyCoachCompleteProfile
                                : aiCopy.studyCoachGuest}
                        </p>
                    </div>
                </div>
                <Link
                    href={profileHref}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-600"
                >
                    {aiCopy.quizFeedbackCta}
                </Link>
            </section>
        );
    }

    return (
        <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-card">
            <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary-500/10 p-3 text-primary-600 dark:text-primary-300">
                    <BrainCircuit className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{aiCopy.studyCoachTitle}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{aiCopy.studyCoachDescription}</p>
                </div>
            </div>

            <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isLoading}
                className="mt-4 rounded-xl bg-primary-500 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"
            >
                {isLoading ? aiCopy.studyCoachLoading : aiCopy.studyCoachAction}
            </button>

            {error ? (
                <p className="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>
            ) : null}

            {notice ? (
                <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">{notice}</p>
            ) : null}

            {coachResponse ? (
                <div className="mt-5 space-y-4 text-sm leading-6 text-gray-700 dark:text-gray-200">
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{aiCopy.studyCoachFocusAreas}</p>
                        <ul className="mt-2 space-y-2">
                            {coachResponse.coach.focusAreas.map((item) => (
                                <li key={item} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-slate-800/70">{item}</li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{aiCopy.studyCoachPlan}</p>
                        <ul className="mt-2 space-y-2">
                            {coachResponse.coach.todayPlan.map((item) => (
                                <li key={item} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-slate-800/70">{item}</li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{aiCopy.studyCoachReason}</p>
                        <p>{coachResponse.coach.reason}</p>
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{aiCopy.studyCoachNote}</p>
                        <p>{coachResponse.coach.encouragement}</p>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
