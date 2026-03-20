import enTranslations from '@/locales/en.json';
import ruTranslations from '@/locales/ru.json';
import trTranslations from '@/locales/tr.json';
import type { Language } from '@/types';
import { DEFAULT_LANGUAGE } from '@/lib/language';

export type TranslationDictionary = typeof enTranslations;

export const translations: Record<Language, TranslationDictionary> = {
    en: enTranslations,
    ru: ruTranslations,
    tr: trTranslations,
};

const readNestedValue = (
    source: Record<string, unknown>,
    key: string
): unknown => {
    return key.split('.').reduce<unknown>((value, part) => {
        if (!value || typeof value !== 'object') {
            return undefined;
        }

        return (value as Record<string, unknown>)[part];
    }, source);
};

export const getTranslationValue = (
    language: Language,
    key: string
): unknown => {
    const localizedValue = readNestedValue(translations[language], key);
    if (localizedValue !== undefined) {
        return localizedValue;
    }

    return readNestedValue(translations[DEFAULT_LANGUAGE], key);
};

export const getTranslationString = (
    language: Language,
    key: string
): string | undefined => {
    const value = getTranslationValue(language, key);
    return typeof value === 'string' && value.trim().length > 0
        ? value
        : undefined;
};

export const formatTranslation = (
    template: string,
    values: Record<string, string | number>
): string => {
    return Object.entries(values).reduce((result, [key, value]) => (
        result.replaceAll(`{${key}}`, String(value))
    ), template);
};

export const getAllTranslationKeys = (
    source: Record<string, unknown>,
    prefix = ''
): string[] => {
    return Object.entries(source).flatMap(([key, value]) => {
        const nextKey = prefix ? `${prefix}.${key}` : key;

        if (
            value
            && typeof value === 'object'
            && !Array.isArray(value)
        ) {
            return getAllTranslationKeys(value as Record<string, unknown>, nextKey);
        }

        return nextKey;
    });
};
