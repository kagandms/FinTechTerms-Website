'use client';

import React, { useState } from 'react';
import { useLanguage, languageNames, languageFlags } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import { Language } from '@/types';
import { resetAllData } from '@/utils/storage';
import {
    User,
    Flame,
    BookMarked,
    Target,
    RotateCcw,
    Trophy,
    BookOpen,
    Globe,
    ChevronRight,
    AlertTriangle,
    LogIn,
    LogOut,
    Mail,
    Lock,
    UserPlus,
} from 'lucide-react';

export default function ProfilePage() {
    const { t, language, setLanguage } = useLanguage();
    const { userProgress, stats, refreshData, favoritesRemaining } = useSRS();
    const { user, isAuthenticated, login, register, logout } = useAuth();

    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    const handleReset = () => {
        resetAllData();
        refreshData();
        setShowResetConfirm(false);
    };

    const handleAuth = async () => {
        setAuthError('');
        setAuthLoading(true);

        try {
            let success = false;
            if (authMode === 'login') {
                success = await login(authForm.email, authForm.password);
            } else {
                success = await register(authForm.email, authForm.password, authForm.name);
            }

            if (success) {
                setShowAuthModal(false);
                setAuthForm({ email: '', password: '', name: '' });
            } else {
                setAuthError(language === 'tr'
                    ? 'Geçersiz bilgiler. Lütfen tekrar deneyin.'
                    : language === 'ru'
                        ? 'Неверные данные. Попробуйте снова.'
                        : 'Invalid credentials. Please try again.');
            }
        } catch {
            setAuthError(language === 'tr'
                ? 'Bir hata oluştu.'
                : language === 'ru'
                    ? 'Произошла ошибка.'
                    : 'An error occurred.');
        } finally {
            setAuthLoading(false);
        }
    };

    // Calculate total reviews and accuracy
    const totalReviews = userProgress.quiz_history.length;
    const correctReviews = userProgress.quiz_history.filter(q => q.is_correct).length;
    const accuracy = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;

    return (
        <div className="page-content px-4 py-6">
            {/* Header */}
            <header className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                    <User className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">
                    {isAuthenticated ? user?.name : t('profile.title')}
                </h1>
                {isAuthenticated && (
                    <p className="text-sm text-gray-500">{user?.email}</p>
                )}
            </header>

            {/* Auth Section */}
            {!isAuthenticated ? (
                <section className="mb-6">
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 text-white">
                        <div className="flex items-center gap-3 mb-3">
                            <LogIn className="w-5 h-5" />
                            <h3 className="font-semibold">{t('auth.login')} / {t('auth.register')}</h3>
                        </div>
                        <p className="text-white/80 text-sm mb-4">
                            {language === 'tr'
                                ? `Giriş yaparak sınırsız favori ekleyebilirsiniz. Kalan hak: ${favoritesRemaining}`
                                : language === 'ru'
                                    ? `Войдите для безлимитного избранного. Осталось: ${favoritesRemaining}`
                                    : `Sign in for unlimited favorites. Remaining: ${favoritesRemaining}`
                            }
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                                className="flex-1 py-3 bg-white text-primary-600 font-semibold rounded-xl hover:bg-primary-50 transition-colors"
                            >
                                {t('auth.login')}
                            </button>
                            <button
                                onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                                className="flex-1 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-colors"
                            >
                                {t('auth.register')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : (
                <section className="mb-6">
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        {t('auth.logout')}
                    </button>
                </section>
            )}

            {/* Statistics Grid */}
            <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    {t('profile.statistics')}
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    {/* Streak */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-orange-100 rounded-xl">
                                <Flame className="w-5 h-5 text-orange-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.currentStreak')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            {userProgress.current_streak} <span className="text-sm font-normal text-gray-400">{t('profile.days')}</span>
                        </p>
                    </div>

                    {/* Favorites */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary-100 rounded-xl">
                                <BookMarked className="w-5 h-5 text-primary-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.favoriteCount')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            {stats.totalFavorites}
                            {!isAuthenticated && (
                                <span className="text-sm font-normal text-gray-400"> / 50</span>
                            )}
                        </p>
                    </div>

                    {/* Mastered */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-100 rounded-xl">
                                <Trophy className="w-5 h-5 text-green-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.masteredWords')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.mastered}</p>
                    </div>

                    {/* Learning */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 rounded-xl">
                                <BookOpen className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.learningWords')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.learning}</p>
                    </div>

                    {/* Total Reviews */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-100 rounded-xl">
                                <RotateCcw className="w-5 h-5 text-purple-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.totalReviews')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{totalReviews}</p>
                    </div>

                    {/* Accuracy */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-accent-100 rounded-xl">
                                <Target className="w-5 h-5 text-accent-500" />
                            </div>
                            <span className="text-sm text-gray-500">{t('profile.accuracy')}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">%{accuracy}</p>
                    </div>
                </div>
            </section>

            {/* Settings */}
            <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    {t('common.settings')}
                </h2>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Language Selection */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-3">
                            <Globe className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-gray-900">{t('profile.language')}</span>
                        </div>

                        <div className="flex gap-2">
                            {(['tr', 'en', 'ru'] as Language[]).map((lang) => (
                                <button
                                    key={lang}
                                    onClick={() => setLanguage(lang)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${language === lang
                                        ? 'bg-primary-500 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <span>{languageFlags[lang]}</span>
                                    <span className="text-sm">{languageNames[lang].native}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reset Data */}
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="w-full p-4 flex items-center justify-between text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <RotateCcw className="w-5 h-5" />
                            <span className="font-medium">{t('profile.resetData')}</span>
                        </div>
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </section>

            {/* Auth Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            {authMode === 'login' ? (
                                <LogIn className="w-6 h-6 text-primary-500" />
                            ) : (
                                <UserPlus className="w-6 h-6 text-primary-500" />
                            )}
                            <h3 className="text-lg font-bold text-gray-900">
                                {authMode === 'login' ? t('auth.login') : t('auth.register')}
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {authMode === 'register' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('auth.name')}
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={authForm.name}
                                            onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                            placeholder={t('auth.name')}
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('auth.email')}
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        value={authForm.email}
                                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        placeholder={t('auth.email')}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('auth.password')}
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        value={authForm.password}
                                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        placeholder={t('auth.password')}
                                    />
                                </div>
                            </div>

                            {authError && (
                                <p className="text-sm text-red-500">{authError}</p>
                            )}

                            <button
                                onClick={handleAuth}
                                disabled={authLoading}
                                className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
                            >
                                {authLoading
                                    ? '...'
                                    : authMode === 'login'
                                        ? t('auth.login')
                                        : t('auth.register')
                                }
                            </button>

                            <button
                                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                className="w-full text-sm text-gray-500 hover:text-primary-500"
                            >
                                {authMode === 'login' ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}
                            </button>

                            <button
                                onClick={() => setShowAuthModal(false)}
                                className="w-full py-2 text-gray-500 hover:text-gray-700"
                            >
                                {t('auth.guest')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                        <div className="flex items-center gap-3 text-red-500 mb-4">
                            <AlertTriangle className="w-6 h-6" />
                            <h3 className="text-lg font-bold">
                                {language === 'tr' ? 'Dikkat!' : language === 'ru' ? 'Внимание!' : 'Warning!'}
                            </h3>
                        </div>

                        <p className="text-gray-600 mb-6">
                            {language === 'tr'
                                ? 'Tüm ilerlemeniz, favorileriniz ve quiz geçmişiniz silinecek. Bu işlem geri alınamaz.'
                                : language === 'ru'
                                    ? 'Весь ваш прогресс, избранное и история тестов будут удалены. Это действие необратимо.'
                                    : 'All your progress, favorites and quiz history will be deleted. This action cannot be undone.'
                            }
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                {language === 'tr' ? 'İptal' : language === 'ru' ? 'Отмена' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleReset}
                                className="flex-1 py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors"
                            >
                                {language === 'tr' ? 'Sıfırla' : language === 'ru' ? 'Сбросить' : 'Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* App Info */}
            <footer className="text-center text-xs text-gray-400">
                <p>FinTechTerms v0.1.0</p>
                <p className="mt-1">TR-EN-RU Ekonomi ve Bilişim Sözlüğü</p>
            </footer>
        </div>
    );
}
