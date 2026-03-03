'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Language } from '@/types';
import { getCurrentLanguage, setCurrentLanguage as saveLanguage } from '@/utils/storage';

// Import translation files
import trTranslations from '@/locales/tr.json';
import enTranslations from '@/locales/en.json';
import ruTranslations from '@/locales/ru.json';

type TranslationKey = string;
type Translations = typeof trTranslations;

const translations: Record<Language, Translations> = {
    tr: trTranslations,
    en: enTranslations,
    ru: ruTranslations,
};

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
    '/': {
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
    const [language, setLanguageState] = useState<Language>('en');
    const [isHydrated, setIsHydrated] = useState(false);
    const pathname = usePathname();

    // Hydrate from localStorage on mount
    useEffect(() => {
        const saved = getCurrentLanguage();
        setLanguageState(saved);
        setIsHydrated(true);
    }, []);

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        saveLanguage(lang);
    }, []);

    // Update document.title and <html lang=...> based on language and current page
    useEffect(() => {
        if (!isHydrated) return;

        // Update <html lang> attribute
        document.documentElement.lang = language;

        // Find the best matching page title
        const pageTitle = pageTitles[pathname];
        if (pageTitle) {
            document.title = pageTitle[language] || pageTitle.en;
        } else {
            // Fallback for unknown pages
            const defaultTitles: Record<Language, string> = {
                en: 'FinTechTerms | Financial & IT Dictionary',
                tr: 'FinTechTerms | Finans ve Bilişim Sözlüğü',
                ru: 'FinTechTerms | Словарь экономики и IT',
            };
            document.title = defaultTitles[language] || defaultTitles.en;
        }
    }, [language, isHydrated, pathname]);

    /**
     * Get translation by dot-notation key
     * e.g., t('home.welcomeTitle')
     */
    const t = useCallback((key: TranslationKey): string => {
        const keys = key.split('.');
        // eslint-disable-next-line react-hooks/exhaustive-deps
        let value: any = translations[language];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Return key if translation not found
                return key;
            }
        }

        return typeof value === 'string' ? value : key;
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
