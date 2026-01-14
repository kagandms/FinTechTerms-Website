'use client';

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function InstallButton() {
    const { language } = useLanguage();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
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
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setIsInstallable(false);
    };

    if (!isInstallable) return null;

    return (
        <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
        >
            <Download className="w-4 h-4" />
            <span>
                {language === 'tr' ? 'Uygulamayı Yükle' : language === 'ru' ? 'Установить приложение' : 'Install App'}
            </span>
        </button>
    );
}
