'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react';

export default function DailyReview() {
    const { t } = useLanguage();
    const { dueTerms, stats } = useSRS();

    const hasDueCards = dueTerms.length > 0;

    return (
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 text-white shadow-lg overflow-hidden relative">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-lg">{t('home.dailyReview')}</h3>
                </div>

                {hasDueCards ? (
                    <>
                        {/* Due Count */}
                        <div className="mb-4">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-bold">{dueTerms.length}</span>
                                <span className="text-white/80 text-sm">{t('home.dueToday')}</span>
                            </div>
                        </div>

                        {/* Start Quiz Button */}
                        <Link
                            href="/quiz"
                            className="flex items-center justify-between w-full bg-white text-primary-600 font-semibold py-3 px-4 rounded-xl hover:bg-primary-50 transition-all duration-200 shadow-md hover:shadow-lg group"
                        >
                            <span className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                {t('home.startQuiz')}
                            </span>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </>
                ) : (
                    <>
                        {/* No cards due */}
                        <p className="text-white/80 mb-4">
                            {stats.totalFavorites === 0
                                ? t('home.addToFavorites')
                                : t('home.noCardsDue')
                            }
                        </p>

                        {stats.totalFavorites === 0 && (
                            <Link
                                href="/search"
                                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded-xl transition-all duration-200"
                            >
                                <span>{t('home.exploreWords')}</span>
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        )}
                    </>
                )}

                {/* Quick Stats */}
                {stats.totalFavorites > 0 && (
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/20">
                        <div>
                            <p className="text-white/60 text-xs">{t('profile.masteredWords')}</p>
                            <p className="text-lg font-semibold">{stats.mastered}</p>
                        </div>
                        <div>
                            <p className="text-white/60 text-xs">{t('profile.learningWords')}</p>
                            <p className="text-lg font-semibold">{stats.learning}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
