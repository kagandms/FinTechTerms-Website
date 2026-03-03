'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { useAuthLogic } from '@/hooks/useAuthLogic';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';

// Feature Components
import { StatsGrid } from '@/components/features/profile/StatsGrid';
import { SettingsPanel } from '@/components/features/profile/SettingsPanel';
import { AuthModal } from '@/components/features/auth/AuthModal';
import { ResetConfirmModal } from '@/components/features/profile/ResetConfirmModal';
import SmartCard from '@/components/SmartCard';
import TelegramLinkCard from '@/components/TelegramLinkCard';
import { ProfileEditForm } from '@/components/features/profile/ProfileEditForm';

function ProfileContent() {
    // 1. Hook Logic
    const authLogic = useAuthLogic();
    const {
        user, isAuthenticated, language, t,
        showAuthModal, setShowAuthModal,
        authMode, setAuthMode,
        showResetConfirm, setShowResetConfirm,
        handleDataReset
    } = authLogic;

    // 2. Additional Contexts
    const { theme, setTheme } = useTheme();
    const { setLanguage } = useLanguage();
    const { terms, stats, refreshData, userProgress } = useSRS();

    // Calculated fields
    const totalReviews = stats.mastered + stats.learning + (userProgress.total_words_learned || 0);
    const accuracy = userProgress.quiz_history?.length
        ? Math.round((userProgress.quiz_history.filter((q: any) => q.is_correct).length / userProgress.quiz_history.length) * 100)
        : 0;

    return (
        <div className="pb-24 pt-6 px-4 max-w-7xl mx-auto">
            {/* Header */}
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('profile.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {isAuthenticated
                            ? (language === 'tr' ? `Hoş geldin, ${user?.name}` : language === 'ru' ? `С возвращением, ${user?.name}` : `Welcome back, ${user?.name}`)
                            : t('profile.guestMessage')
                        }
                    </p>
                </div>

                <div onClick={() => !isAuthenticated && setShowAuthModal(true)} className="cursor-pointer">
                    {isAuthenticated ? (
                        <div className="w-14 h-14 bg-primary-500 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary-500/30">
                            {user?.email?.charAt(0).toUpperCase()}
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
                <div className="mb-8 p-6 bg-primary-50 dark:bg-primary-900/40 rounded-2xl border border-primary-100 dark:border-primary-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {language === 'tr' ? 'Hesap Oluştur' : language === 'ru' ? 'Создать аккаунт' : 'Create Account'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                            {language === 'tr' ? 'İlerlemeni kaydet ve her yerden eriş.' : language === 'ru' ? 'Сохраните прогресс и синхронизируйте устройства.' : 'Save progress and sync devices.'}
                        </p>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                            className="flex-1 sm:flex-none px-6 py-3 bg-white/80 dark:bg-white/10 text-primary-600 dark:text-primary-200 font-semibold rounded-xl border border-primary-200 dark:border-primary-600 hover:bg-white dark:hover:bg-white/20 transition-all active:scale-95 whitespace-nowrap"
                        >
                            {language === 'tr' ? 'Kayıt Ol' : language === 'ru' ? 'Регистрация' : 'Sign Up'}
                        </button>
                        <button
                            onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
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
                <div className="lg:col-span-8 space-y-8">
                    {/* Stats Grid */}
                    <section>
                        <StatsGrid
                            userProgress={userProgress}
                            stats={stats}
                            totalReviews={totalReviews}
                            accuracy={accuracy}
                            isAuthenticated={isAuthenticated}
                            t={t}
                        />
                    </section>

                    {/* Authenticated Dashboard Forms */}
                    {isAuthenticated && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {/* Profile Edit Form */}
                            <section className="xl:col-span-2">
                                <ProfileEditForm language={language} />
                            </section>
                        </div>
                    )}

                    {/* Favorites List */}
                    {userProgress.favorites.length > 0 && (
                        <section>
                            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                {language === 'tr' ? 'Favorilerim' : language === 'ru' ? 'Мои избранные' : 'My Favorites'}
                            </h2>
                            <div className="space-y-4">
                                {terms.filter(term => userProgress.favorites.includes(term.id)).map(term => (
                                    <SmartCard key={term.id} term={term} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Right Column (Settings & Integrations) */}
                <div className="lg:col-span-4 space-y-8">

                    {/* Telegram Integration */}
                    {isAuthenticated && (
                        <section>
                            <TelegramLinkCard />
                        </section>
                    )}

                    {/* App Settings Panel */}
                    <SettingsPanel
                        t={t}
                        language={language}
                        setLanguage={setLanguage}
                        theme={theme}
                        setTheme={setTheme}
                        onResetClick={() => setShowResetConfirm(true)}
                    />

                    {/* Logout Button */}
                    {isAuthenticated && (
                        <button
                            onClick={authLogic.logout}
                            className="w-full py-4 text-red-500 font-bold bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm"
                        >
                            {language === 'tr' ? 'Çıkış Yap' : language === 'ru' ? 'Выход' : 'Log Out'}
                        </button>
                    )}
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

            <footer className="text-center text-xs text-gray-400 mt-16 pt-8 border-t border-gray-100 dark:border-gray-800">
                <p>FinTechTerms v1.0.0</p>
                <p className="mt-2">
                    {language === 'tr'
                        ? 'TR-EN-RU Ekonomi ve FinTech Sözlüğü'
                        : language === 'ru'
                            ? 'Словарь экономики и FinTech (RU-EN-TR)'
                            : 'TR-EN-RU Economics & FinTech Dictionary'}
                </p>
            </footer>
        </div>
    );
}

// Wrapper for Suspense (needed for useSearchParams in Hook)
export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div></div>}>
            <ProfileContent />
        </Suspense>
    );
}

