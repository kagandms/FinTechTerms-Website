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
import TelegramBanner from '@/components/TelegramBanner';
import SmartCard from '@/components/SmartCard';

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

    // 2. Additional Contexts (not in authLogic)
    const { theme, setTheme } = useTheme();
    const { setLanguage } = useLanguage();
    const { terms, stats, refreshData, userProgress } = useSRS();

    // Calculated fields
    const totalReviews = stats.mastered + stats.learning + (userProgress.total_words_learned || 0);
    const accuracy = userProgress.quiz_history?.length
        ? Math.round((userProgress.quiz_history.filter((q: any) => q.is_correct).length / userProgress.quiz_history.length) * 100)
        : 0;

    return (
        <div className="pb-24 pt-6 px-4 max-w-2xl mx-auto">
            {/* Header */}
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
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
                        <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary-500/30">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                    ) : (
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors">
                            <User className="w-6 h-6" />
                        </div>
                    )}
                </div>
            </header>

            {/* Login Prompt Banner */}
            {!isAuthenticated && (
                <div className="mb-8 p-4 bg-primary-50 dark:bg-primary-900/40 rounded-2xl border border-primary-100 dark:border-primary-800 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-primary-900 dark:text-primary-100 mb-1">
                            {language === 'tr' ? 'Hesap Oluştur' : language === 'ru' ? 'Создать аккаунт' : 'Create Account'}
                        </h3>
                        <p className="text-sm text-primary-700 dark:text-primary-300">
                            {language === 'tr' ? 'İlerlemeni kaydet ve her yerden eriş.' : language === 'ru' ? 'Сохраните прогресс и синхронизируйте устройства.' : 'Save progress and sync devices.'}
                        </p>
                    </div>
                    <div className="flex gap-2 text-sm justify-end sm:justify-start">
                        <button
                            onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                            className="px-4 py-2 bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-300 font-semibold rounded-xl border border-primary-200 dark:border-primary-700 hover:bg-primary-100 transition-transform active:scale-95"
                        >
                            {language === 'tr' ? 'Kayıt Ol' : language === 'ru' ? 'Регистрация' : 'Sign Up'}
                        </button>
                        <button
                            onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                            className="px-4 py-2 bg-primary-500 text-white font-semibold rounded-xl shadow-md shadow-primary-500/20 hover:bg-primary-600 transition-transform active:scale-95"
                        >
                            {t('auth.login')}
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <StatsGrid
                userProgress={userProgress}
                stats={stats}
                totalReviews={totalReviews}
                accuracy={accuracy}
                isAuthenticated={isAuthenticated}
                t={t}
            />

            {/* Favorites List */}
            {userProgress.favorites.length > 0 && (
                <div className="mb-8 mt-2">
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                        {language === 'tr' ? 'Favorilerim' : language === 'ru' ? 'Мои избранные' : 'My Favorites'}
                    </h2>
                    <div className="space-y-4">
                        {terms.filter(t => userProgress.favorites.includes(t.id)).map(term => (
                            <SmartCard key={term.id} term={term} />
                        ))}
                    </div>
                </div>
            )}

            {/* Settings Panel */}
            <SettingsPanel
                t={t}
                language={language}
                setLanguage={setLanguage}
                theme={theme}
                setTheme={setTheme}
                onResetClick={() => setShowResetConfirm(true)}
            />

            {/* Telegram Bot CTA */}
            <div className="mb-4">
                <TelegramBanner variant="compact" />
            </div>

            {isAuthenticated && (
                <button
                    onClick={authLogic.logout}
                    className="w-full py-4 text-red-500 font-medium bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors mb-8"
                >
                    {language === 'tr' ? 'Çıkış Yap' : language === 'ru' ? 'Выйти' : 'Log Out'}
                </button>
            )}

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

            <footer className="text-center text-xs text-gray-400">
                <p>FinTechTerms v0.1.0</p>
                <p className="mt-1">
                    {language === 'tr'
                        ? 'TR-EN-RU Ekonomi ve Bilişim Sözlüğü'
                        : language === 'ru'
                            ? 'Словарь экономики и IT (RU-EN-TR)'
                            : 'TR-EN-RU Economics & IT Dictionary'}
                </p>
            </footer>
        </div>
    );
}

// Wrapper for Suspense (needed for useSearchParams in Hook)
export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="page-content px-4 py-6 text-center">Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
