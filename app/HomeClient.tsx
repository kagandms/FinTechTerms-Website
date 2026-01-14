'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useTheme } from '@/contexts/ThemeContext';
import DailyReview from '@/components/DailyReview';
import SmartCard from '@/components/SmartCard';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import InstallButton from '@/components/InstallButton';
import Link from 'next/link';
import Image from 'next/image';
import { Flame, BookMarked, TrendingUp, Sun, Moon } from 'lucide-react';

const siteUrl = 'https://fintechterms.vercel.app';

export default function HomePage() {
    const { t } = useLanguage();
    const { terms, userProgress, stats } = useSRS();
    const { theme, resolvedTheme, setTheme } = useTheme();

    // Get 3 random terms to display
    const recentTerms = terms.slice(0, 3);

    // Toggle theme quickly
    const toggleTheme = () => {
        if (resolvedTheme === 'dark') {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    };

    return (
        <div className="page-content px-4 py-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'WebSite',
                        name: 'FinTechTerms',
                        url: siteUrl,
                        potentialAction: {
                            '@type': 'SearchAction',
                            target: `${siteUrl}/search?q={search_term_string}`,
                            'query-input': 'required name=search_term_string'
                        }
                    }),
                }}
            />
            {/* Mobile Header (Compact) */}
            <header className="flex md:hidden items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Image
                        src="/ftt.png"
                        alt="FinTechTerms Logo"
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain"
                        priority
                    />
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-primary-500 dark:text-primary-400 leading-tight truncate">
                            FinTechTerms
                        </h1>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">
                            {t('home.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <InstallButton />
                    <button
                        onClick={toggleTheme}
                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Toggle theme"
                    >
                        {resolvedTheme === 'dark' ? (
                            <Sun className="w-4 h-4 text-yellow-500" />
                        ) : (
                            <Moon className="w-4 h-4 text-gray-600" />
                        )}
                    </button>
                    <LanguageSwitcher />
                </div>
            </header>

            {/* Desktop Header (Spacious) */}
            <header className="hidden md:flex items-center justify-between mb-10 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-4">
                    <Image
                        src="/ftt.png"
                        alt="FinTechTerms Logo"
                        width={80}
                        height={80}
                        className="w-20 h-20 object-contain drop-shadow-sm hover:scale-105 transition-transform"
                        priority
                    />
                    <div>
                        <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400 tracking-tight">
                            FinTechTerms
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                            {t('home.subtitle')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 mr-4">
                        <div className="flex flex-col items-end">
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{t('profile.days')}</span>
                            <span className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                <Flame className="w-4 h-4 text-orange-500" />
                                {userProgress.current_streak}
                            </span>
                        </div>
                    </div>

                    <InstallButton />

                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                        aria-label="Toggle theme"
                    >
                        {resolvedTheme === 'dark' ? (
                            <Sun className="w-5 h-5 text-yellow-500" />
                        ) : (
                            <Moon className="w-5 h-5 text-gray-600" />
                        )}
                    </button>
                    <div className="ml-2">
                        <LanguageSwitcher />
                    </div>
                </div>
            </header>

            {/* Daily Review Card */}
            <section className="mb-6">
                <DailyReview />
            </section>

            {/* Quick Stats */}
            {userProgress.quiz_history.length > 0 && (
                <section className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                <Flame className="w-5 h-5 text-orange-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{userProgress.current_streak}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.days')}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                                <BookMarked className="w-5 h-5 text-primary-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalFavorites}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.favoriteCount')}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">%{stats.averageRetention}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.accuracy')}</p>
                    </div>
                </section>
            )}

            {/* Recent Terms */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
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
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('home.categories')}
                </h2>

                <div className="grid grid-cols-3 gap-3">
                    {[
                        { key: 'Fintech', color: 'from-violet-500 to-purple-600', icon: '💳' },
                        { key: 'Finance', color: 'from-emerald-400 to-green-600', icon: '💰' },
                        { key: 'Technology', color: 'from-slate-700 to-black', icon: '💻' },
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
