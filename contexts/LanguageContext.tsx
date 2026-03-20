'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Language } from '@/types';
import { getCurrentLanguage, setCurrentLanguage as saveLanguage } from '@/utils/storage';
import { DEFAULT_LANGUAGE } from '@/lib/language';
import { getTranslationString } from '@/lib/i18n';

type TranslationKey = string;

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
    children: ReactNode;
}

// Page-specific titles for each language
const pageTitles: Record<string, Record<Language, string>> = {
    '/dashboard': {
        en: 'FinTechTerms | Financial & IT Dictionary',
        tr: 'FinTechTerms | Finans ve Bilişim Sözlüğü',
        ru: 'FinTechTerms | Словарь экономики и IT',
    },
    '/search': {
        en: 'Search | FinTechTerms',
        tr: 'Arama | FinTechTerms',
        ru: 'Поиск | FinTechTerms',
    },
    '/quiz': {
        en: 'Practice | FinTechTerms',
        tr: 'Pratik | FinTechTerms',
        ru: 'Практика | FinTechTerms',
    },
    '/profile': {
        en: 'Profile | FinTechTerms',
        tr: 'Profil | FinTechTerms',
        ru: 'Профиль | FinTechTerms',
    },
    '/about-project': {
        en: 'About Project | FinTechTerms',
        tr: 'Proje Hakkında | FinTechTerms',
        ru: 'О проекте | FinTechTerms',
    },
    '/analytics': {
        en: 'Analytics | FinTechTerms',
        tr: 'Analitik | FinTechTerms',
        ru: 'Аналитика | FinTechTerms',
    },
};

export function LanguageProvider({ children }: LanguageProviderProps) {
    const [language, setLanguageState] = useState<Language>(() => getCurrentLanguage());
    const [isHydrated] = useState(() => typeof window !== 'undefined');
    const pathname = usePathname();

    const setLanguage = useCallback((lang: Language) => {
        const nextLanguage = ['ru', 'en', 'tr'].includes(lang) ? lang : DEFAULT_LANGUAGE;
        setLanguageState(nextLanguage);
        saveLanguage(nextLanguage);
    }, []);

    // Update document.title and <html lang=...> based on language and current page
    useEffect(() => {
        if (!isHydrated) return;

        // Update <html lang> attribute
        document.documentElement.lang = language;

        // Find the best matching page title
        const pageTitle = pageTitles[pathname];
        if (pageTitle) {
            document.title = pageTitle[language] || pageTitle[DEFAULT_LANGUAGE];
        } else {
            // Fallback for unknown pages
            const defaultTitles: Record<Language, string> = {
                en: 'FinTechTerms | Financial & IT Dictionary',
                tr: 'FinTechTerms | Finans ve Bilişim Sözlüğü',
                ru: 'FinTechTerms | Словарь экономики и IT',
            };
            document.title = defaultTitles[language] || defaultTitles[DEFAULT_LANGUAGE];
        }
    }, [language, isHydrated, pathname]);

    /**
     * Get translation by dot-notation key
     * e.g., t('home.welcomeTitle')
     */
    const t = useCallback((key: TranslationKey): string => {
        return getTranslationString(language, key)
            ?? getTranslationString(DEFAULT_LANGUAGE, key)
            ?? key;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

/**
 * Hook to access language context
 */
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

/**
 * Language names for display
 */
export const languageNames: Record<Language, { native: string; english: string }> = {
    tr: { native: 'Türkçe', english: 'Turkish' },
    en: { native: 'English', english: 'English' },
    ru: { native: 'Русский', english: 'Russian' },
};

/**
 * Flag emojis for language display
 */
export const languageFlags: Record<Language, string> = {
    tr: '🇹🇷',
    en: '🇬🇧',
    ru: '🇷🇺',
};
