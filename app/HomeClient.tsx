'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import DailyReview from '@/components/DailyReview';
import SmartCard from '@/components/SmartCard';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import InstallButton from '@/components/InstallButton';
import TelegramBanner from '@/components/TelegramBanner';
import Image from 'next/image';
import Link from 'next/link';
import { BookMarked, BrainCircuit, TrendingUp, Sun, Moon, Send } from 'lucide-react';
import SRSNotificationCard from '@/components/profile/SRSNotificationCard';
import { getSiteUrl } from '@/lib/site-url';

import { Term } from '@/types';
import type { LearningStatsActionResult } from '@/types/gamification';

interface HomeClientProps {
    initialTerms?: Term[];
    nonce?: string;
    learningStats?: LearningStatsActionResult | null;
}

const pickInitialTerms = (terms: Term[]): Term[] => terms.slice(0, 3);

const shuffleTerms = (terms: Term[]): Term[] => {
    const nextTerms = [...terms];

    for (let index = nextTerms.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const currentTerm = nextTerms[index];
        const swapTerm = nextTerms[swapIndex];

        if (!currentTerm || !swapTerm) {
            continue;
        }

        nextTerms[index] = swapTerm;
        nextTerms[swapIndex] = currentTerm;
    }

    return nextTerms;
};

export default function HomePage({ initialTerms = [], nonce, learningStats = null }: HomeClientProps) {
    const { t } = useLanguage();
    const { terms, userProgress, stats } = useSRS();
    const { resolvedTheme, setTheme } = useTheme();
    const { isAuthenticated } = useAuth();

    const displayTerms = terms.length > 0 ? terms : initialTerms;
    const siteUrl = getSiteUrl();
    const exactAccuracy = isAuthenticated && learningStats?.ok
        ? learningStats.data.accuracy
        : null;
    const guestAccuracy = userProgress.quiz_history.length > 0
        ? Math.round((userProgress.quiz_history.filter((attempt) => attempt.is_correct).length / userProgress.quiz_history.length) * 100)
        : 0;
    const accuracyLabel = isAuthenticated
        ? (exactAccuracy === null ? '—' : `%${exactAccuracy}`)
        : `%${guestAccuracy}`;
    const shouldShowQuickStats = isAuthenticated
        ? Boolean(learningStats?.ok && (learningStats.data.totalReviews ?? 0) > 0)
        : userProgress.quiz_history.length > 0;
    const recentTerms = React.useMemo<Term[]>(() => (
        displayTerms.length <= 3
            ? pickInitialTerms(displayTerms)
            : pickInitialTerms(shuffleTerms(displayTerms))
    ), [displayTerms]);

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
                nonce={nonce}
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
            {/* Mobile Header (Prominent Logo) */}
            <header className="flex md:hidden flex-col items-center justify-center mb-8 gap-4 pt-4 relative">
                <Image
                    src="/home-logo.png"
                    alt="FinTechTerms Logo"
                    height={90}
                    width={100}
                    className="w-24 h-auto object-contain drop-shadow-lg rounded-2xl"
                    priority
                />
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-primary-500 dark:text-primary-400 leading-tight">
                        FinTechTerms
                    </h1>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium leading-tight mt-1">
                        {t('home.subtitle')}
                    </p>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-center gap-2 mt-2">
                    <a
                        href="https://t.me/FinTechTermsBot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl border border-sky-100 bg-white text-sky-600 transition-colors hover:border-sky-200 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800 flex items-center justify-center"
                        aria-label={t('shell.telegramIntegration')}
                    >
                        <Send className="w-5 h-5" />
                    </a>
                    <div className="flex items-center justify-center">
                        <InstallButton variant="prominent" />
                    </div>
                    <button
                        onClick={toggleTheme}
                        data-testid="theme-toggle"
                        className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
                        aria-label={t('shell.toggleTheme')}
                    >
                        {resolvedTheme === 'dark' ? (
                            <Sun className="w-5 h-5 text-yellow-500" />
                        ) : (
                            <Moon className="w-5 h-5 text-gray-600" />
                        )}
                    </button>
                    <LanguageSwitcher />
                </div>
            </header>

            {/* Desktop Header (Spacious) */}
            {/* Desktop Header (Hero Style) */}
            <header className="relative z-50 -mx-4 mb-12 hidden rounded-b-3xl border-b border-gray-100 bg-white/50 px-8 py-7 shadow-sm backdrop-blur-md dark:border-[#0c3452]/50 dark:bg-[#0a2d46]/80 lg:block">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)] lg:items-center">
                    <div className="flex min-w-0 items-center gap-8">
                        <div className="relative group shrink-0">
                            <Image
                                src="/home-logo.png"
                                alt="FinTechTerms Logo"
                                width={160}
                                height={144}
                                className="w-40 h-auto object-contain shadow-2xl transition-transform duration-500 group-hover:scale-105 rounded-3xl"
                                priority
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="max-w-[min(100%,38rem)] bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-[clamp(3rem,5.2vw,4.75rem)] font-extrabold leading-[0.9] tracking-tighter text-transparent dark:from-white dark:to-gray-300">
                                FinTechTerms
                            </h1>
                            <p className="mt-3 max-w-2xl text-lg font-medium leading-relaxed text-gray-500 dark:text-gray-400">
                                {t('home.subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:justify-self-end lg:w-full lg:max-w-[21rem]">
                        <a
                            href="https://t.me/FinTechTermsBot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-14 items-center justify-center rounded-2xl border border-sky-100 bg-white p-3 text-sky-600 shadow-sm transition-all hover:border-sky-200 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800"
                            aria-label={t('shell.telegramIntegration')}
                        >
                            <Send className="w-5 h-5" />
                        </a>
                        <div className="[&>button]:h-14 [&>button]:w-full [&>button]:justify-center [&>[data-testid='install-button-placeholder']]:h-14 [&>[data-testid='install-button-placeholder']]:w-full">
                            <InstallButton variant="prominent" />
                        </div>

                        <button
                            onClick={toggleTheme}
                            data-testid="theme-toggle"
                            className="flex h-14 items-center justify-center rounded-2xl border border-gray-100 bg-white p-3 text-gray-500 shadow-sm transition-all hover:bg-gray-50 hover:text-yellow-500 dark:border-white/20 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20 dark:hover:text-yellow-300 backdrop-blur-sm"
                            aria-label={t('shell.toggleTheme')}
                        >
                            {resolvedTheme === 'dark' ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>
                        <div className="w-full [&>div]:w-full [&>div>button]:h-14 [&>div>button]:w-full [&>div>button]:justify-between [&>div>button]:rounded-2xl">
                            <LanguageSwitcher />
                        </div>
                    </div>
                </div>
            </header>

            {/* Daily Review Card */}
            <section className="mb-6">
                <DailyReview />
            </section>

            <section className="mb-6">
                <SRSNotificationCard
                    dueCount={stats.dueToday}
                    lastReviewDate={userProgress.last_study_date}
                />
            </section>

            {/* Quick Stats */}
            {shouldShowQuickStats && (
                <section className="grid grid-cols-3 gap-3 mb-6">
                    <div className="app-surface rounded-xl p-4 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                                <BrainCircuit className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.dueToday}</p>
                        <p className="app-text-secondary text-xs">{t('home.quickStatsDue')}</p>
                    </div>

                    <Link
                        href="/favorites"
                        aria-label={t('home.openFavorites')}
                        className="app-surface rounded-xl p-4 text-center hover:ring-2 hover:ring-primary-500 hover:shadow-md transition-all cursor-pointer group block"
                    >
                        <div className="flex justify-center mb-2 group-hover:scale-110 transition-transform">
                            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                                <BookMarked className="w-5 h-5 text-primary-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{stats.totalFavorites}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.favoriteCount')}</p>
                    </Link>

                    <div className="app-surface rounded-xl p-4 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {accuracyLabel}
                        </p>
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
                                {t('home.noTerms') || 'Загрузка терминов...'}
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
