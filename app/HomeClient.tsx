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
import TelegramBanner from '@/components/TelegramBanner';

import { Term } from '@/types';

const siteUrl = 'https://fintechterms.vercel.app';

interface HomeClientProps {
    initialTerms?: Term[];
}

export default function HomePage({ initialTerms = [] }: HomeClientProps) {
    const { t } = useLanguage();
    const { terms, userProgress, stats } = useSRS();
    const { theme, resolvedTheme, setTheme } = useTheme();

    // Get 3 random terms to display (prioritize context, fallback to server data)
    const displayTerms = terms.length > 0 ? terms : initialTerms;
    const recentTerms = displayTerms.slice(0, 3);

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
                        height={48}
                        width={48}
                        className="w-12 h-12 object-contain rounded-2xl"
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
            {/* Desktop Header (Hero Style) */}
            <header className="hidden md:flex items-center justify-between mb-12 py-8 border-b border-gray-100 dark:border-primary-800 bg-white/50 dark:bg-primary-900/50 backdrop-blur-sm -mx-4 px-8 rounded-b-3xl shadow-sm relative z-50">
                <div className="flex items-center gap-8">
                    <div className="relative group shrink-0">
                        {/* Wrapper for definitive rounding */}
                        <div className="relative w-40 h-40 rounded-[2rem] overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 bg-white dark:bg-primary-800/30">
                            <Image
                                src="/ftt.png"
                                alt="FinTechTerms Logo"
                                fill
                                className="object-cover"
                                priority
                            />
                        </div>
                    </div>
                    <div className="flex flex-col justify-center h-40">
                        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 tracking-tighter mb-2">
                            FinTechTerms
                        </h1>
                        <p className="text-lg text-gray-500 dark:text-gray-400 font-medium max-w-md leading-relaxed">
                            {t('home.subtitle')}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-6 h-40 justify-center">
                    {/* Streak Badge */}
                    <div className="px-6 py-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{t('profile.days')}</span>
                            <span className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <Flame className="w-6 h-6 text-orange-500 fill-orange-500 animate-pulse" />
                                {userProgress.current_streak}
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                        <InstallButton />

                        <div className="h-10 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

                        <button
                            onClick={toggleTheme}
                            className="p-3 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 transition-all border border-gray-100 dark:border-gray-700 shadow-sm"
                            aria-label="Toggle theme"
                        >
                            {resolvedTheme === 'dark' ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>
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
                    {recentTerms.length > 0 ? (
                        recentTerms.map((term) => (
                            <SmartCard key={term.id} term={term} />
                        ))
                    ) : (
                        <div className="p-8 text-center rounded-xl bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">
                                {t('home.noTerms') || 'Term data loading...'}
                            </p>
                        </div>
                    )}
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

            {/* Telegram Bot CTA */}
            <section className="mt-8">
                <TelegramBanner variant="full" />
            </section>
        </div>
    );
}
