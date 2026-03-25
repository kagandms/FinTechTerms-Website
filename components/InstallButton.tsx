'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallButtonProps {
    variant?: 'compact' | 'prominent';
}

type NavigatorWithStandalone = Navigator & {
    standalone?: boolean;
};

type WindowWithMSStream = Window & {
    MSStream?: unknown;
};

const isStandaloneDisplayMode = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
    return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
};

const canShowIOSInstallInstructions = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    const windowWithMSStream = window as WindowWithMSStream;
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && windowWithMSStream.MSStream === undefined;
    return isIOSDevice && !isStandaloneDisplayMode();
};

export default function InstallButton({ variant = 'compact' }: InstallButtonProps) {
    const { t } = useLanguage();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isIOSInstallAvailable, setIsIOSInstallAvailable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [hasEvaluatedInstallability, setHasEvaluatedInstallability] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);
    const [showManualInstructions, setShowManualInstructions] = useState(false);

    useEffect(() => {
        let revealFrameId: number | null = null;

        const cancelRevealFrame = () => {
            if (revealFrameId === null) {
                return;
            }

            if (typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(revealFrameId);
            } else {
                window.clearTimeout(revealFrameId);
            }

            revealFrameId = null;
        };

        const scheduleReveal = () => {
            cancelRevealFrame();

            const reveal = () => {
                setHasEvaluatedInstallability(true);
                revealFrameId = null;
            };

            if (typeof window.requestAnimationFrame === 'function') {
                revealFrameId = window.requestAnimationFrame(reveal);
                return;
            }

            revealFrameId = window.setTimeout(reveal, 0);
        };

        const syncInstallability = () => {
            setIsIOSInstallAvailable(canShowIOSInstallInstructions());
            setIsInstalled(isStandaloneDisplayMode());
            scheduleReveal();
        };

        const handleBeforeInstallPrompt = (e: Event) => {
            const promptEvent = e as BeforeInstallPromptEvent;
            e.preventDefault();
            setDeferredPrompt(promptEvent);
        };

        const handleAppInstalled = () => {
            setDeferredPrompt(null);
            setIsIOSInstallAvailable(false);
            setIsInstalled(true);
            setShowIOSInstructions(false);
            setShowManualInstructions(false);
        };

        syncInstallability();
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            cancelRevealFrame();
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isIOSInstallAvailable) {
            setShowIOSInstructions(true);
            return;
        }

        if (!deferredPrompt) {
            setShowManualInstructions(true);
            return;
        }

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        setDeferredPrompt(null);
        if (outcome === 'dismissed') {
            setShowManualInstructions(true);
        }
    };

    if (isInstalled) {
        return null;
    }

    const buttonClassName = variant === 'prominent'
        ? 'min-w-[9rem] shrink-0 whitespace-nowrap flex items-center justify-center gap-2 rounded-xl border border-transparent bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-700 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
        : 'shrink-0 flex items-center justify-center gap-2 rounded-lg border border-transparent bg-primary-600 p-1.5 text-sm font-medium text-white shadow-sm transition-colors active:scale-95 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 sm:rounded-xl sm:px-3 sm:py-2';

    if (variant === 'prominent' && !hasEvaluatedInstallability) {
        return (
            <div
                aria-hidden="true"
                data-testid="install-button-placeholder"
                className={`${buttonClassName} invisible pointer-events-none select-none`}
            >
                <Download className="w-4 h-4" />
                <span className="text-sm">{t('install.cta')}</span>
            </div>
        );
    }

    return (
        <>
            <button
                onClick={handleInstallClick}
                className={buttonClassName}
            >
                <Download className="w-4 h-4" />
                <span className={variant === 'prominent' ? 'text-sm' : 'text-xs sm:text-sm'}>
                    {t('install.cta')}
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
                            aria-label={t('shell.close')}
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/ftt.png" alt="App Icon" className="w-12 h-12 rounded-2xl object-cover" />
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {t('install.iosTitle')}
                            </h3>

                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                {t('install.iosDescription')}
                            </p>

                            <div className="flex flex-col gap-3 w-full bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl text-left text-sm">
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-600 rounded-full shadow-sm text-xs font-bold">1</span>
                                    <span>
                                        {t('install.iosStep1Lead')}
                                        <Share className="w-4 h-4 inline mx-1 text-blue-500" />
                                        {t('install.iosStep1Action')}
                                    </span>
                                </div>
                                <div className="w-full h-px bg-gray-200 dark:bg-gray-600/50" />
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-600 rounded-full shadow-sm text-xs font-bold">2</span>
                                    <span>
                                        {t('install.iosStep2')}
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
                            aria-label={t('shell.close')}
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center shadow-inner">
                                <Download className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {t('install.manualTitle')}
                            </h3>

                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                {t('install.manualDescription')}
                            </p>

                            <div className="flex flex-col gap-3 w-full bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl text-left text-sm">
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-600 rounded-full shadow-sm text-xs font-bold">1</span>
                                    <span>
                                        {t('install.manualStep1')}
                                    </span>
                                </div>
                                <div className="w-full h-px bg-gray-200 dark:bg-gray-600/50" />
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-600 rounded-full shadow-sm text-xs font-bold">2</span>
                                    <span>
                                        {t('install.manualStep2')}
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
