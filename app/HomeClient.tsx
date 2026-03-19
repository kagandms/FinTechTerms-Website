'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import DailyReview from '@/components/DailyReview';
import SmartCard from '@/components/SmartCard';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import InstallButton from '@/components/InstallButton';
import Image from 'next/image';
import { BookMarked, BrainCircuit, TrendingUp, Sun, Moon, Send } from 'lucide-react';
import TelegramBanner from '@/components/TelegramBanner';
import SRSNotificationCard from '@/components/profile/SRSNotificationCard';
import { getSiteUrl } from '@/lib/site-url';

import { Term } from '@/types';

interface HomeClientProps {
    initialTerms?: Term[];
    nonce?: string;
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

export default function HomePage({ initialTerms = [], nonce }: HomeClientProps) {
    const { t, language } = useLanguage();
    const { terms, userProgress, stats } = useSRS();
    const { resolvedTheme, setTheme } = useTheme();
    const { isAuthenticated } = useAuth();
    const router = useRouter();

    const displayTerms = terms.length > 0 ? terms : initialTerms;
    const siteUrl = getSiteUrl();
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

    const uiCopy = {
        tr: {
            telegramAria: 'Telegram API entegrasyonunu aç',
            themeAria: 'Temayı değiştir',
            openFavorites: 'Favorileri aç',
        },
        en: {
            telegramAria: 'Open Telegram API integration',
            themeAria: 'Toggle theme',
            openFavorites: 'Open favorites',
        },
        ru: {
            telegramAria: 'Открыть интеграцию Telegram API',
            themeAria: 'Переключить тему',
            openFavorites: 'Открыть избранное',
        },
    }[language];

    const openFavorites = () => {
        if (isAuthenticated) {
            router.push('/favorites');
            return;
        }

        router.push('/profile?auth=login&next=%2Ffavorites');
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
                        aria-label={uiCopy.telegramAria}
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
                        aria-label={uiCopy.themeAria}
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
            <header className="hidden md:flex items-center justify-between mb-12 py-8 border-b border-gray-100 dark:border-[#0c3452]/50 bg-white/50 dark:bg-[#0a2d46]/80 backdrop-blur-md -mx-4 px-8 rounded-b-3xl relative z-50 shadow-sm">
                <div className="flex items-center gap-8">
                    <div className="relative group shrink-0">
                        {/* Wrapper with soft rounded corners */}
                        <Image
                            src="/home-logo.png"
                            alt="FinTechTerms Logo"
                            width={160}
                            height={144}
                            className="w-40 h-auto object-contain shadow-2xl transition-transform duration-500 group-hover:scale-105 rounded-3xl"
                            priority
                        />
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

                <div className="flex flex-col items-end gap-4 h-40 justify-center">
                    <div className="flex items-center gap-3">
                        <a
                            href="https://t.me/FinTechTermsBot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-xl border border-sky-100 bg-white text-sky-600 transition-all shadow-sm hover:border-sky-200 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800"
                            aria-label={uiCopy.telegramAria}
                        >
                            <Send className="w-5 h-5" />
                        </a>
                        <InstallButton variant="prominent" />

                        <div className="h-10 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

                        <button
                            onClick={toggleTheme}
                            data-testid="theme-toggle"
                            className="p-3 rounded-xl bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/20 text-gray-500 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-300 transition-all border border-gray-100 dark:border-white/20 shadow-sm backdrop-blur-sm"
                            aria-label={uiCopy.themeAria}
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

            <section className="mb-6">
                <SRSNotificationCard
                    dueCount={stats.dueToday}
                    lastReviewDate={userProgress.last_study_date}
                />
            </section>

            {/* Quick Stats */}
            {userProgress.quiz_history.length > 0 && (
                <section className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                                <BrainCircuit className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.dueToday}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">К повтору</p>
                    </div>

                    <button
                        type="button"
                        onClick={openFavorites}
                        aria-label={uiCopy.openFavorites}
                        className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center hover:ring-2 hover:ring-primary-500 hover:shadow-md transition-all cursor-pointer group block"
                    >
                        <div className="flex justify-center mb-2 group-hover:scale-110 transition-transform">
                            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                                <BookMarked className="w-5 h-5 text-primary-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{stats.totalFavorites}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.favoriteCount')}</p>
                    </button>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">%{userProgress.quiz_history?.length
                            ? Math.round((userProgress.quiz_history.filter((q: any) => q.is_correct).length / userProgress.quiz_history.length) * 100)
                            : 0}</p>
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
