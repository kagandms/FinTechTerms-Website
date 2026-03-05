'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { useAuthLogic } from '@/hooks/useAuthLogic';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { Settings, BookMarked, Mail } from 'lucide-react';
import Link from 'next/link';

// Feature Components
import { StatsGrid } from '@/components/features/profile/StatsGrid';
import { SettingsPanel } from '@/components/features/profile/SettingsPanel';
import { AuthModal } from '@/components/features/auth/AuthModal';
import { ResetConfirmModal } from '@/components/features/profile/ResetConfirmModal';
import SmartCard from '@/components/SmartCard';
import TelegramLinkCard from '@/components/TelegramLinkCard';
import TelegramBanner from '@/components/TelegramBanner';
import { ProfileEditForm } from '@/components/features/profile/ProfileEditForm';
import type { ProfileFormInitialData } from '@/components/features/profile/ProfileEditForm';
import InstallButton from '@/components/InstallButton';

interface ProfilePageClientProps {
    initialProfileData: ProfileFormInitialData | null;
}

function ProfileContent({ initialProfileData }: ProfilePageClientProps) {
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

    // Toggle for Profile Editing
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    // Calculated fields
    const totalReviews = (stats?.mastered || 0) + (stats?.learning || 0) + (userProgress?.total_words_learned || 0);
    const accuracy = userProgress?.quiz_history?.length
        ? Math.round((userProgress?.quiz_history?.filter((q: any) => q.is_correct)?.length || 0) / (userProgress?.quiz_history?.length || 1) * 100)
        : 0;

    const getInitials = (name: string, email: string) => {
        if (!name) return email?.charAt(0).toUpperCase() || 'U';
        const parts = name.trim().split(' ');
        if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
            return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
        }
        return name.charAt(0).toUpperCase();
    };

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
                        <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-black shadow-lg shadow-primary-500/30 tracking-tight ring-2 ring-white dark:ring-gray-800">
                            {getInitials(user?.name || '', user?.email || '')}
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
                            {language === 'tr' ? 'Hesap Oluştur' : language === 'ru' ? 'Создать аккаунт' : 'Create Account'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                            {language === 'tr' ? 'İlerlemeni kaydet ve her yerden eriş.' : language === 'ru' ? 'Сохраните прогресс и синхронизируйте устройства.' : 'Save progress and sync devices.'}
                        </p>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                            className="flex-1 sm:flex-none px-6 py-3 bg-white dark:bg-gray-700 text-primary-600 dark:text-white font-semibold rounded-xl border border-primary-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all active:scale-95 whitespace-nowrap"
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
                <div className="lg:col-span-8 space-y-8 flex flex-col">
                    {/* Stats Grid - Always at top */}
                    <section className="order-1">
                        <StatsGrid
                            userProgress={userProgress}
                            stats={stats}
                            totalReviews={totalReviews}
                            accuracy={accuracy}
                            isAuthenticated={isAuthenticated}
                            t={t}
                        />
                    </section>

                    {/* View Favorites CTA - Moved UP in Mobile (order-2), remains on right on Large screens */}
                    <section className="lg:hidden order-2 bg-gradient-to-r from-primary-600 to-blue-500 rounded-2xl p-6 text-white shadow-xl flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-emerald-400 opacity-20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>

                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm z-10">
                            <BookMarked className="w-8 h-8 text-white" />
                        </div>
                        <div className="z-10">
                            <h3 className="text-xl font-bold">{language === 'tr' ? 'Favorilerim' : language === 'ru' ? 'Мои избранные' : 'My Favorites'}</h3>
                            <p className="text-white/80 text-sm mt-1">{stats.totalFavorites} {language === 'tr' ? 'Kelime kayıtlı' : language === 'ru' ? 'Слов сохранено' : 'Words saved'}</p>
                        </div>
                        <Link href="/favorites" className="mt-2 relative z-10 w-full px-4 py-3 bg-white text-primary-600 font-bold rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-md">
                            {language === 'tr' ? 'Görüntüle' : language === 'ru' ? 'Смотреть' : 'View Library'}
                        </Link>
                    </section>

                    {/* Authenticated Dashboard Forms - order-3 */}
                    {isAuthenticated && (
                        <div className="grid grid-cols-1 gap-6 order-3 mt-8 lg:mt-0">
                            {/* Profile Edit Action */}
                            <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {language === 'tr' ? 'Profilini Düzenle' : language === 'ru' ? 'Редактировать профиль' : 'Edit Profile'}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                        {language === 'tr' ? 'Kişisel bilgilerinizi ve hesap ayarlarınızı güncelleyin.' : language === 'ru' ? 'Обновите вашу личную информацию и настройки аккаунта.' : 'Update your personal information and account settings.'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                                    className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Settings className="w-4 h-4" />
                                    {isEditingProfile
                                        ? (language === 'tr' ? 'Kapat' : language === 'ru' ? 'Закрыть' : 'Close')
                                        : (language === 'tr' ? 'Düzenle' : language === 'ru' ? 'Редактировать' : 'Edit')}
                                </button>
                            </section>

                            {isEditingProfile && (
                                <section className="animate-fade-in">
                                    <ProfileEditForm language={language} initialData={initialProfileData} />
                                </section>
                            )}
                        </div>
                    )}

                    <div className="space-y-8 mt-8 border-t border-gray-100 dark:border-gray-800 pt-8 order-4">
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
                            <h3 className="text-xl font-bold">{language === 'tr' ? 'Favorilerim' : language === 'ru' ? 'Мои избранные' : 'My Favorites'}</h3>
                            <p className="text-white/80 text-sm mt-1">{stats.totalFavorites} {language === 'tr' ? 'Kelime kayıtlı' : language === 'ru' ? 'Слов сохранено' : 'Words saved'}</p>
                        </div>
                        <Link href="/favorites" className="mt-2 relative z-10 w-full px-4 py-3 bg-white text-primary-600 font-bold rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-md">
                            {language === 'tr' ? 'Görüntüle' : language === 'ru' ? 'Смотреть' : 'View Library'}
                        </Link>
                    </section>

                    {/* Telegram Integration */}
                    <section className="space-y-6">
                        <TelegramBanner variant="compact" />
                        {isAuthenticated && (
                            <TelegramLinkCard />
                        )}
                    </section>

                    {/* Install App Button — Profile */}
                    <section className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {language === 'tr' ? 'Uygulamayı Yükle' : language === 'ru' ? 'Установить приложение' : 'Install App'}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {language === 'tr' ? 'Ana ekranınıza ekleyin. Offline mod ve hızlı erişim heykecanını yaşayın.' : language === 'ru' ? 'Добавьте на главный экр. Наслаждайтесь оффлайн-режимом и быстрым доступом.' : 'Add to your home screen. Enjoy offline mode and quick access.'}
                            </p>
                        </div>
                        <InstallButton />
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
                    className="w-full py-4 text-red-500 font-bold bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm mt-8"
                >
                    {language === 'tr' ? 'Çıkış Yap' : language === 'ru' ? 'Выход' : 'Log Out'}
                </button>
            )}

            {/* Contact Section */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mt-8">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {language === 'tr' ? 'İletişim' : language === 'ru' ? 'Контакты' : 'Contact'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {language === 'tr'
                        ? 'Sorularınız veya önerileriniz için bize ulaşabilirsiniz:'
                        : language === 'ru'
                            ? 'Свяжитесь с нами по вопросам или предложениям:'
                            : 'Reach out to us with questions or suggestions:'}
                </p>
                <a
                    href="mailto:fintechterms@mail.ru"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium rounded-xl border border-primary-100 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                >
                    <Mail className="w-4 h-4" />
                    fintechterms@mail.ru
                </a>
            </section>

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
export default function ProfilePageClient({ initialProfileData }: ProfilePageClientProps) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div></div>}>
            <ProfileContent initialProfileData={initialProfileData} />
        </Suspense>
    );
}
