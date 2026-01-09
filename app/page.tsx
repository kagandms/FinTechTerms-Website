'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import DailyReview from '@/components/DailyReview';
import SmartCard from '@/components/SmartCard';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Flame, BookMarked, TrendingUp } from 'lucide-react';

export default function HomePage() {
    const { t } = useLanguage();
    const { terms, userProgress, stats } = useSRS();

    // Get 3 random terms to display
    const recentTerms = terms.slice(0, 3);

    return (
        <div className="page-content px-4 py-6">
            {/* Header */}
            <header className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-primary-500">
                        GlobalFinTerm
                    </h1>
                    <p className="text-sm text-gray-500">
                        {t('home.subtitle')}
                    </p>
                </div>
                <LanguageSwitcher />
            </header>

            {/* Daily Review Card */}
            <section className="mb-6">
                <DailyReview />
            </section>

            {/* Quick Stats */}
            {userProgress.quiz_history.length > 0 && (
                <section className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Flame className="w-5 h-5 text-orange-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{userProgress.current_streak}</p>
                        <p className="text-xs text-gray-500">{t('profile.days')}</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-primary-100 rounded-lg">
                                <BookMarked className="w-5 h-5 text-primary-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalFavorites}</p>
                        <p className="text-xs text-gray-500">{t('profile.favoriteCount')}</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">%{stats.averageRetention}</p>
                        <p className="text-xs text-gray-500">{t('profile.accuracy')}</p>
                    </div>
                </section>
            )}

            {/* Recent Terms */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {t('home.recentTerms')}
                    </h2>
                </div>

                <div className="space-y-4">
                    {recentTerms.map((term) => (
                        <SmartCard key={term.id} term={term} />
                    ))}
                </div>
            </section>

            {/* Categories Preview */}
            <section className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('home.categories')}
                </h2>

                <div className="grid grid-cols-3 gap-3">
                    {[
                        { key: 'Fintech', color: 'from-amber-400 to-orange-500', icon: '💳' },
                        { key: 'Economics', color: 'from-blue-400 to-primary-500', icon: '📈' },
                        { key: 'Computer Science', color: 'from-purple-400 to-indigo-500', icon: '💻' },
                    ].map((cat) => {
                        const count = terms.filter(t => t.category === cat.key).length;
                        return (
                            <div
                                key={cat.key}
                                className={`relative overflow-hidden rounded-xl p-4 bg-gradient-to-br ${cat.color} text-white shadow-md hover-lift cursor-pointer`}
                            >
                                <span className="text-3xl mb-2 block">{cat.icon}</span>
                                <p className="text-xs font-medium opacity-90">{t(`categories.${cat.key}`)}</p>
                                <p className="text-lg font-bold">{count}</p>
                                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
