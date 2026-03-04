'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function InstallButton() {
    const { language, t } = useLanguage();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);
    const [showManualInstructions, setShowManualInstructions] = useState(false);

    useEffect(() => {
        // Check if device is iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        // Check if already in standalone mode (installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

        if (isIOSDevice && !isStandalone) {
            setIsIOS(true);
            setIsInstallable(true); // BUG 2 FIXED: Was missing, causing invisible button on iOS
        } else {
            // For other devices, we assume installable unless running standalone
            // but we only get deferredPrompt if browser supports it.
            // If not standalone, we show button anyway.
            setIsInstallable(!isStandalone);
        }

        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isIOS) {
            setShowIOSInstructions(true);
            return;
        }

        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt();

            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;

            // We've used the prompt, and can't use it again, throw it away
            setDeferredPrompt(null);
            // Don't hide button immediately, maybe they cancelled
            if (outcome === 'accepted') {
                setIsInstallable(false);
            }
        } else {
            // Fallback: Show manual instructions
            setShowManualInstructions(true);
        }
    };

    if (!isInstallable) return null;

    return (
        <>
            <button
                onClick={handleInstallClick}
                className="flex items-center justify-center gap-2 p-1.5 sm:px-3 sm:py-2 bg-primary-600 hover:bg-primary-700 dark:bg-white/10 dark:hover:bg-white/20 text-white dark:text-white rounded-lg sm:rounded-xl transition-colors text-sm font-medium shadow-sm backdrop-blur-sm active:scale-95 border border-transparent dark:border-white/20"
            >
                <Download className="w-4 h-4" />
                <span className="text-xs sm:text-sm">
                    {language === 'tr' ? 'Yükle' : language === 'ru' ? 'Установить' : 'Install'}
                </span>
            </button>

            {/* iOS Instructions Modal */}
            {showIOSInstructions && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none p-4">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto transition-opacity animate-fade-in"
                        onClick={() => setShowIOSInstructions(false)}
                    />

                    {/* Modal */}
                    <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl pointer-events-auto animate-slide-up sm:animate-scale-in border border-gray-100 dark:border-gray-700">
                        <button
                            onClick={() => setShowIOSInstructions(false)}
                            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/ftt.png" alt="App Icon" className="w-12 h-12 rounded-2xl object-cover" />
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {language === 'tr' ? 'iOS\'a Nasıl Yüklenir?' : language === 'ru' ? 'Как установить на iOS?' : 'How to Install on iOS?'}
                            </h3>

                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                {language === 'tr'
                                    ? 'Bu uygulamayı ana ekranınıza eklemek için şu adımları izleyin:'
                                    : language === 'ru'
                                        ? 'Чтобы добавить приложение на главный экран, выполните следующие действия:'
                                        : 'Follow these steps to add this app to your home screen:'}
                            </p>

                            <div className="flex flex-col gap-3 w-full bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl text-left text-sm">
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-600 rounded-full shadow-sm text-xs font-bold">1</span>
                                    <span>
                                        {language === 'tr' ? 'Aşağıdaki' : language === 'ru' ? 'Нажмите кнопку' : 'Tap the'}
                                        <Share className="w-4 h-4 inline mx-1 text-blue-500" />
                                        {language === 'tr' ? 'paylaş butonuna basın' : language === 'ru' ? 'Поделиться' : 'Share button'}
                                    </span>
                                </div>
                                <div className="w-full h-px bg-gray-200 dark:bg-gray-600/50" />
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-600 rounded-full shadow-sm text-xs font-bold">2</span>
                                    <span>
                                        {language === 'tr' ? '"Ana Ekrana Ekle"yi seçin' : language === 'ru' ? 'Выберите "На экран домой"' : 'Select "Add to Home Screen"'}
                                        <PlusSquare className="w-4 h-4 inline mx-1 text-gray-500" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Instructions Modal (Desktop/Chrome/Other) */}
            {showManualInstructions && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto transition-opacity animate-fade-in"
                        onClick={() => setShowManualInstructions(false)}
                    />
                    <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl pointer-events-auto animate-scale-in border border-gray-100 dark:border-gray-700">
                        <button
                            onClick={() => setShowManualInstructions(false)}
                            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center shadow-inner">
                                <Download className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {language === 'tr' ? 'Uygulama Nasıl Yüklenir?' : language === 'ru' ? 'Как установить приложение?' : 'How to Install?'}
                            </h3>

                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                {language === 'tr'
                                    ? 'Tarayıcı menüsünü kullanarak uygulamayı yükleyebilirsiniz:'
                                    : language === 'ru'
                                        ? 'Вы можете установить приложение через меню браузера:'
                                        : 'You can install the app using the browser menu:'}
                            </p>

                            <div className="flex flex-col gap-3 w-full bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl text-left text-sm">
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-600 rounded-full shadow-sm text-xs font-bold">1</span>
                                    <span>
                                        {language === 'tr' ? 'Tarayıcı menüsünü (⋮) açın' : language === 'ru' ? 'Откройте меню браузера (⋮)' : 'Open browser menu (⋮)'}
                                    </span>
                                </div>
                                <div className="w-full h-px bg-gray-200 dark:bg-gray-600/50" />
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-600 rounded-full shadow-sm text-xs font-bold">2</span>
                                    <span>
                                        {language === 'tr' ? '"Uygulamayı Yükle" veya "Ana Ekrana Ekle"yi seçin' : language === 'ru' ? 'Выберите "Установить приложение" или "Добавить на гл. экран"' : 'Select "Install App" or "Add to Home Screen"'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
