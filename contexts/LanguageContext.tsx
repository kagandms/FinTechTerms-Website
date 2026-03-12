'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Language } from '@/types';
import { getCurrentLanguage, setCurrentLanguage as saveLanguage } from '@/utils/storage';
import { DEFAULT_LANGUAGE } from '@/lib/language';

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
        const keys = key.split('.');
        const resolveNestedValue = (sourceLanguage: Language): unknown => {
            let value: unknown = translations[sourceLanguage];

            for (const part of keys) {
                if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
                    value = (value as Record<string, unknown>)[part];
                } else {
                    return undefined;
                }
            }

            return value;
        };

        const localizedValue = resolveNestedValue(language);
        if (typeof localizedValue === 'string' && localizedValue.trim()) {
            return localizedValue;
        }

        const defaultFallback = resolveNestedValue(DEFAULT_LANGUAGE);
        if (typeof defaultFallback === 'string' && defaultFallback.trim()) {
            return defaultFallback;
        }

        return key;
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
