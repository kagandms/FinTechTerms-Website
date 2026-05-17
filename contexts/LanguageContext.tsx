'use client';

import React, { createContext, useCallback, useContext, useEffect, useSyncExternalStore, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Language } from '@/types';
import { getCurrentLanguage, setCurrentLanguage as saveLanguage } from '@/utils/storage';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '@/lib/language';
import { getTranslationString } from '@/lib/i18n';

type TranslationKey = string;

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

type LanguagePreferenceListener = () => void;

const languagePreferenceListeners = new Set<LanguagePreferenceListener>();

const readLanguagePreference = (): Language => getCurrentLanguage();

const readServerLanguagePreference = (): Language => DEFAULT_LANGUAGE;

const notifyLanguagePreferenceListeners = (): void => {
    languagePreferenceListeners.forEach((listener) => listener());
};

const subscribeToLanguagePreference = (
    listener: LanguagePreferenceListener
): (() => void) => {
    languagePreferenceListeners.add(listener);

    return () => {
        languagePreferenceListeners.delete(listener);
    };
};

const writeLanguagePreference = (language: Language): void => {
    const nextLanguage = normalizeLanguage(language) ?? DEFAULT_LANGUAGE;
    const previousLanguage = readLanguagePreference();

    saveLanguage(nextLanguage);

    if (previousLanguage === nextLanguage) {
        return;
    }

    notifyLanguagePreferenceListeners();
};

interface LanguageProviderProps {
    children: ReactNode;
}

const defaultPageTitles: Record<Language, string> = {
    en: 'FinTechTerms | Financial & IT Dictionary',
    tr: 'FinTechTerms | Finans ve Bilişim Sözlüğü',
    ru: 'FinTechTerms | Словарь экономики и IT',
};

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

const resolvePageTitle = ({
    language,
    pathname,
}: {
    readonly language: Language;
    readonly pathname: string;
}): string => {
    const titleByLanguage = pageTitles[pathname] ?? defaultPageTitles;
    return titleByLanguage[language] ?? titleByLanguage[DEFAULT_LANGUAGE];
};

const syncDocumentLanguage = ({
    language,
    pathname,
}: {
    readonly language: Language;
    readonly pathname: string;
}): void => {
    document.documentElement.lang = language;
    document.title = resolvePageTitle({ language, pathname });
};

/**
 * Provides the active UI language from URL overrides, stored preference, and explicit user changes.
 */
export function LanguageProvider({ children }: LanguageProviderProps): React.JSX.Element {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const preferredLanguage = useSyncExternalStore(
        subscribeToLanguagePreference,
        readLanguagePreference,
        readServerLanguagePreference
    );
    const queryLanguage = normalizeLanguage(searchParams.get('lang'));
    const language = queryLanguage ?? preferredLanguage;

    const setLanguage = useCallback((lang: Language): void => {
        writeLanguagePreference(lang);
    }, []);

    useEffect(() => {
        if (!queryLanguage) {
            return;
        }

        writeLanguagePreference(queryLanguage);
    }, [queryLanguage]);

    useEffect(() => {
        syncDocumentLanguage({ language, pathname });
    }, [language, pathname]);

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
export function useLanguage(): LanguageContextType {
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
