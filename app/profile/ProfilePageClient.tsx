'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';
import { useAuthLogic } from '@/hooks/useAuthLogic';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Settings, BookMarked, Mail } from 'lucide-react';
import Link from 'next/link';

// Feature Components
import { StatsGrid } from '@/components/features/profile/StatsGrid';
import { SettingsPanel } from '@/components/features/profile/SettingsPanel';
import { AuthModal } from '@/components/features/auth/AuthModal';
import { ResetConfirmModal } from '@/components/features/profile/ResetConfirmModal';
import TelegramBanner from '@/components/TelegramBanner';
import { ProfileEditForm } from '@/components/features/profile/ProfileEditForm';
import type { ProfileFormInitialData } from '@/components/features/profile/ProfileEditForm';
import type { LearningStatsActionResult } from '@/types/gamification';
import InstallButton from '@/components/InstallButton';
import Heatmap from '@/components/profile/Heatmap';
import ProfileErrorBoundary from '@/components/profile/ProfileErrorBoundary';
import SRSNotificationCard from '@/components/profile/SRSNotificationCard';
import { formatTranslation } from '@/lib/i18n';
import { logger } from '@/lib/logger';

interface ProfilePageClientProps {
    initialProfileData: ProfileFormInitialData | null;
    learningStats: LearningStatsActionResult;
    profileWarningCode: ProfileWarningCode | null;
}

export type ProfileWarningCode = 'PROFILE_DATA_PARTIAL' | 'PROFILE_DATA_LOAD_FAILED';

interface ProfileContentProps {
    initialProfileData: ProfileFormInitialData | null;
    learningStats: LearningStatsActionResult;
}

function ProfileContent({ initialProfileData, learningStats }: ProfileContentProps) {
    // 1. Hook Logic
    const authLogic = useAuthLogic();
    const {
        user, isAuthenticated, language, t,
        showAuthModal, setShowAuthModal,
        setAuthMode,
        showResetConfirm, setShowResetConfirm,
        handleDataReset,
        router,
    } = authLogic;

    // 2. Additional Contexts
    const { theme, setTheme } = useTheme();
    const { setLanguage } = useLanguage();
    const { stats, refreshData, userProgress } = useSRS();

    // Toggle for Profile Editing
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    // Calculated fields
    const learningStatsData = learningStats.ok ? learningStats.data : null;
    const totalReviews = learningStatsData?.totalReviews ?? (isAuthenticated ? null : 0);
    const accuracy = learningStatsData?.accuracy ?? (isAuthenticated ? null : 0);
    const showLearningAnalyticsFallback = isAuthenticated
        && !learningStats.ok
        && learningStats.error.code !== 'UNAUTHORIZED';

    const getInitials = (name: string, fallbackId?: string | null) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            const safeFallback = (fallbackId || '').replace(/-/g, '').slice(0, 2).toUpperCase();
            return safeFallback || 'U';
        }

        const parts = trimmedName.split(' ');
        if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
            return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
        }
        return trimmedName.charAt(0).toUpperCase();
    };

    const openFavorites = () => {
        if (isAuthenticated) {
            router.push('/favorites');
            return;
        }

        router.push('/profile?auth=login&next=%2Ffavorites');
    };
    const welcomeMessage = isAuthenticated
        ? formatTranslation(t('profile.welcomeBack'), { name: user?.name ?? '' })
        : t('profile.guestMessage');
    const savedWordsCount = formatTranslation(t('profile.savedWordsCount'), {
        count: stats.totalFavorites,
    });

    return (
        <div className="pb-24 pt-6 px-4 max-w-7xl mx-auto">
            {/* Header */}
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('profile.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {welcomeMessage}
                    </p>
                </div>

                <div onClick={() => !isAuthenticated && setShowAuthModal(true)} className="cursor-pointer">
                    {isAuthenticated ? (
                        <div data-testid="user-avatar" className="w-14 h-14 bg-gradient-to-br from-primary-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-black shadow-lg shadow-primary-500/30 tracking-tight ring-2 ring-white dark:ring-gray-800">
                            {getInitials(user?.name || '', user?.id)}
                        </div>
                    ) : (
                        <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors">
                            <User className="w-7 h-7" />
                        </div>
                    )}
                </div>
            </header>

            {/* Login Prompt Banner (Guest Only) */}
            {!isAuthenticated && (
                <div className="mb-8 p-6 bg-primary-50 dark:bg-gray-800 rounded-2xl border border-primary-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {t('profile.guestCreateTitle')}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                            {t('profile.guestCreateDescription')}
                        </p>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                            data-testid="open-auth-register"
                            className="flex-1 sm:flex-none px-6 py-3 bg-white dark:bg-gray-700 text-primary-600 dark:text-white font-semibold rounded-xl border border-primary-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all active:scale-95 whitespace-nowrap"
                        >
                            {t('profile.registerCta')}
                        </button>
                        <button
                            onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                            data-testid="open-auth-login"
                            className="flex-1 sm:flex-none px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl shadow-md shadow-primary-500/20 hover:bg-primary-600 transition-transform active:scale-95 whitespace-nowrap"
                        >
                            {t('auth.login')}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column (Stats & Favorites) */}
                <div className="lg:col-span-8 space-y-8 flex flex-col">
                    {/* Stats Grid - Always at top */}
                    <section className="order-1">
                        <StatsGrid
                            stats={stats}
                            totalReviews={totalReviews}
                            accuracy={accuracy}
                            isAuthenticated={isAuthenticated}
                            t={t}
                        />
                    </section>

                    {isAuthenticated && (
                        <section className="order-2 space-y-6">
                            <SRSNotificationCard
                                dueCount={stats.dueToday}
                                lastReviewDate={learningStatsData?.lastStudyDate ?? userProgress?.last_study_date}
                            />
                            {learningStatsData ? (
                                <Heatmap entries={learningStatsData.heatmap} language={language} />
                            ) : null}
                        </section>
                    )}

                    {showLearningAnalyticsFallback && (
                        <section className="order-2 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 text-sm text-[var(--text-secondary)] shadow-card">
                            {t('profile.learningAnalyticsUnavailable')}
                        </section>
                    )}

                    {/* View Favorites CTA - Moved UP in Mobile (order-2), remains on right on Large screens */}
                    <section className="lg:hidden order-3 bg-gradient-to-r from-primary-600 to-blue-500 rounded-2xl p-6 text-white shadow-xl flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-emerald-400 opacity-20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>

                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm z-10">
                            <BookMarked className="w-8 h-8 text-white" />
                        </div>
                        <div className="z-10">
                            <h3 className="text-xl font-bold">{t('profile.favoritesTitle')}</h3>
                            <p className="text-white/80 text-sm mt-1">{savedWordsCount}</p>
                        </div>
                        <button
                            type="button"
                            onClick={openFavorites}
                            className="mt-2 relative z-10 w-full rounded-xl bg-white px-4 py-3 font-bold text-primary-600 shadow-md transition-all hover:bg-gray-50 active:scale-95"
                        >
                            {t('profile.viewLibrary')}
                        </button>
                    </section>

                    {/* Authenticated Dashboard Forms - order-3 */}
                    {isAuthenticated && (
                        <div className="grid grid-cols-1 gap-6 order-4 mt-8 lg:mt-0">
                            {/* Profile Edit Action */}
                            <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {t('profile.editProfileTitle')}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                        {t('profile.editProfileDescription')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                                    data-testid="profile-edit-toggle"
                                    className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Settings className="w-4 h-4" />
                                    {isEditingProfile
                                        ? t('profile.closeEdit')
                                        : t('profile.edit')}
                                </button>
                            </section>

                            {isEditingProfile && (
                                <section className="animate-fade-in">
                                    <ProfileEditForm language={language} initialData={initialProfileData} />
                                </section>
                            )}
                        </div>
                    )}

                    <div className="space-y-8 mt-8 border-t border-gray-100 dark:border-gray-800 pt-8 order-5">
                        {/* App Settings Panel */}
                        <SettingsPanel
                            t={t}
                            language={language}
                            setLanguage={setLanguage}
                            theme={theme}
                            setTheme={setTheme}
                            onResetClick={() => setShowResetConfirm(true)}
                        />
                    </div>

                </div>

                {/* Right Column (Desktop Favorites & Others) */}
                <div className="lg:col-span-4 space-y-8">

                    {/* View Favorites CTA - Desktop only - shown when not in mobile view */}
                    <section className="hidden lg:flex bg-gradient-to-r from-primary-600 to-blue-500 rounded-2xl p-6 text-white shadow-xl flex-col items-center justify-center text-center gap-3 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-emerald-400 opacity-20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>

                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm z-10">
                            <BookMarked className="w-8 h-8 text-white" />
                        </div>
                        <div className="z-10">
                            <h3 className="text-xl font-bold">{t('profile.favoritesTitle')}</h3>
                            <p className="text-white/80 text-sm mt-1">{savedWordsCount}</p>
                        </div>
                        <button
                            type="button"
                            onClick={openFavorites}
                            className="mt-2 relative z-10 w-full rounded-xl bg-white px-4 py-3 font-bold text-primary-600 shadow-md transition-all hover:bg-gray-50 active:scale-95"
                        >
                            {t('profile.viewLibrary')}
                        </button>
                    </section>

                    {/* Telegram Bot */}
                    <section>
                        <TelegramBanner variant="compact" />
                    </section>

                    {/* Install App Button — Profile */}
                    <section className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {t('profile.installTitle')}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {t('profile.installDescription')}
                            </p>
                        </div>
                        <InstallButton variant="prominent" />
                    </section>
                </div>
            </div>

            {/* Modals */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                {...authLogic} // Spread all logic props
            />

            <ResetConfirmModal
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={() => handleDataReset(refreshData)}
                language={language}
            />

            {/* Logout Button — always at the very bottom */}
            {isAuthenticated && (
                <button
                    onClick={authLogic.logout}
                    className="w-full py-4 text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm mt-8"
                >
                    {t('auth.logout')}
                </button>
            )}

            {/* Contact Section */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mt-8">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {t('profile.contactTitle')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {t('profile.contactDescription')}
                </p>
                <a
                    href="mailto:fintechterms@mail.ru"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-50 dark:bg-gray-900 text-primary-700 dark:text-white font-semibold rounded-xl border border-primary-100 dark:border-primary-400 hover:bg-primary-100 dark:hover:bg-gray-800 transition-colors break-all"
                >
                    <Mail className="w-4 h-4 text-primary-600 dark:text-primary-300" />
                    fintechterms@mail.ru
                </a>
            </section>

            <footer className="text-center text-xs text-gray-400 mt-16 pt-8 border-t border-gray-100 dark:border-gray-800">
                <p>FinTechTerms v1.0.0</p>
                <p className="mt-2">
                    {t('profile.footerDictionary')}
                </p>
            </footer>
        </div>
    );
}

// Wrapper for Suspense (needed for useSearchParams in Hook)
export default function ProfilePageClient({
    initialProfileData,
    learningStats,
    profileWarningCode,
}: ProfilePageClientProps) {
    const { isAuthenticated } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const lastProfileWarningRef = useRef<ProfileWarningCode | null>(null);
    const lastLearningStatsErrorRef = useRef<string | null>(null);

    useEffect(() => {
        if (!profileWarningCode || lastProfileWarningRef.current === profileWarningCode) {
            return;
        }

        logger.warn('PROFILE_PAGE_WARNING', {
            route: 'ProfilePageClient',
            warningCode: profileWarningCode,
        });
        showToast(
            profileWarningCode === 'PROFILE_DATA_PARTIAL'
                ? t('profile.warningPartial')
                : t('profile.warningUnavailable'),
            'warning'
        );
        lastProfileWarningRef.current = profileWarningCode;
    }, [language, profileWarningCode, showToast, t]);

    useEffect(() => {
        if (learningStats.ok || !isAuthenticated || learningStats.error.code === 'UNAUTHORIZED') {
            return;
        }

        if (lastLearningStatsErrorRef.current === learningStats.error.code) {
            return;
        }

        logger.warn('PROFILE_PAGE_LEARNING_ANALYTICS_FALLBACK', {
            route: 'ProfilePageClient',
            errorCode: learningStats.error.code,
        });
        showToast(t('profile.learningAnalyticsUnavailable'), 'warning');
        lastLearningStatsErrorRef.current = learningStats.error.code;
    }, [isAuthenticated, learningStats, showToast, t]);

    const handleBoundaryError = useCallback((error: Error) => {
        logger.error('PROFILE_PAGE_RENDER_ERROR', {
            route: 'ProfilePageClient',
            error,
        });
        showToast(t('profile.renderError'), 'error');
    }, [showToast, t]);

    return (
        <ProfileErrorBoundary language={language} onError={handleBoundaryError}>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div></div>}>
                <ProfileContent initialProfileData={initialProfileData} learningStats={learningStats} />
            </Suspense>
        </ProfileErrorBoundary>
    );
}
