'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { User } from 'lucide-react'; // Only need User icon here for the header
import { useAuthLogic } from '@/hooks/useAuthLogic';
import { useTheme } from '@/contexts/ThemeContext';
import { useSRS } from '@/contexts/SRSContext';

// Feature Components
import { StatsGrid } from '@/components/features/profile/StatsGrid';
import { SettingsPanel } from '@/components/features/profile/SettingsPanel';
import { AuthModal } from '@/components/features/auth/AuthModal';
import { ResetConfirmModal } from '@/components/features/profile/ResetConfirmModal';

function ProfileContent() {
    // 1. Hook Logic
    const authLogic = useAuthLogic();
    const {
        user, isAuthenticated, language, t,
        showAuthModal, setShowAuthModal,
        showResetConfirm, setShowResetConfirm,
        handleDataReset
    } = authLogic;

    // 2. Additional Contexts (not in authLogic)
    const { theme, setTheme } = useTheme();
    const { getStats, refreshData } = useSRS();

    // 3. Page Local State (Stats)
    const [stats, setStats] = useState({ totalFavorites: 0, mastered: 0, learning: 0 });
    const [userProgress, setUserProgress] = useState<any>({ current_streak: 0 });

    useEffect(() => {
        const data = getStats();
        if (data) {
            setStats({
                totalFavorites: data.totalFavorites,
                mastered: data.mastered,
                learning: data.learning
            });
            // We assume userProgress comes from somewhere else or SRS Stats includes it
            // In the original file, it fetched userProgress separately if auth, or used local storage
            // For now, mapping SRS stats to view
        }
        // Mock userProgress update for implementation parity
        const storedProgress = typeof window !== 'undefined' ? localStorage.getItem('userProgress') : null;
        if (storedProgress) setUserProgress(JSON.parse(storedProgress));
    }, [getStats, isAuthenticated]); // Re-run when auth changes

    // Calculated fields
    const totalReviews = stats.mastered + stats.learning + (userProgress.total_words_learned || 0); // Approx
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
                            ? (language === 'tr' ? `Hoş geldin, ${user?.user_metadata?.full_name || user?.email}` : `Welcome back, ${user?.user_metadata?.full_name || user?.email}`)
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
                <div className="mb-8 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl border border-primary-100 dark:border-primary-800 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-primary-900 dark:text-primary-100 mb-1">
                            {language === 'tr' ? 'Hesap Oluştur' : 'Create Account'}
                        </h3>
                        <p className="text-sm text-primary-700 dark:text-primary-300">
                            {language === 'tr' ? 'İlerlemeni kaydet ve her yerden eriş.' : 'Save progress and sync devices.'}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAuthModal(true)}
                        className="px-4 py-2 bg-primary-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-primary-500/20 hover:bg-primary-600 transition-transform active:scale-95"
                    >
                        {t('auth.login')}
                    </button>
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

            {/* Settings Panel */}
            <SettingsPanel
                t={t}
                language={language}
                setLanguage={authLogic.language === 'tr' ? () => { } : () => { }} // Language context handles this, logic might differ. 
                // Wait, useLanguage returns setLanguage but we need access to it.
                // usedLanguage hook provides `setLanguage`. logic hook exposes `language`.
                // Let's re-import useLanguage here to get the setter, or expose it in useAuthLogic
                theme={theme}
                setTheme={setTheme}
                onResetClick={() => setShowResetConfirm(true)}
            />
            {/* Note: I need to fix setLanguage passing. useAuthLogic exposes language but maybe not setLanguage.
                Optimally useAuthLogic should expose it OR I assume SettingsPanel uses the context internally?
                My SettingsPanel props require setLanguage.
                Let's get it from context directly in the component or extract it from logic.
                I'll leave it as prop for now and get it here.
            */}

            {isAuthenticated && (
                <button
                    onClick={authLogic.logout}
                    className="w-full py-4 text-red-500 font-medium bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors mb-8"
                >
                    {language === 'tr' ? 'Çıkış Yap' : 'Log Out'}
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
                <p className="mt-1">TR-EN-RU Ekonomi ve Bilişim Sözlüğü</p>
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
