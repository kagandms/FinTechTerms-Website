import type { Language } from '@/types';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['ru', 'en', 'tr'] as const;
export const LANGUAGE_COOKIE_NAME = 'ftt-language';

export const normalizeLanguage = (value: string | null | undefined): Language | null => {
    if (!value) {
        return null;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
        return null;
    }

    const baseLanguage = normalizedValue.split(/[-_]/)[0];
    if (baseLanguage === 'ru' || baseLanguage === 'en' || baseLanguage === 'tr') {
        return baseLanguage;
    }

    return null;
};

// NEXT_PUBLIC_DEFAULT_LANGUAGE is intentionally deploy-configurable so request headers and the client boot from the same locale.
export const DEFAULT_LANGUAGE: Language = normalizeLanguage(process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE) ?? 'ru';

const parseQualityValue = (value: string | undefined): number => {
    if (!value) {
        return 1;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const resolvePreferredLanguage = ({
    cookieValue,
    acceptLanguage,
}: {
    cookieValue?: string | null;
    acceptLanguage?: string | null;
}): Language => {
    const cookieLanguage = normalizeLanguage(cookieValue);
    if (cookieLanguage) {
        return cookieLanguage;
    }

    if (acceptLanguage) {
        const acceptedLanguages = acceptLanguage
            .split(',')
            .map((entry) => {
                const [languageTag, qualityPart] = entry.trim().split(';q=');

                return {
                    language: normalizeLanguage(languageTag),
                    quality: parseQualityValue(qualityPart),
                };
            })
            .filter((entry): entry is { language: Language; quality: number } => entry.language !== null)
            .sort((left, right) => right.quality - left.quality);

        if (acceptedLanguages[0]?.language) {
            return acceptedLanguages[0].language;
        }
    }

    return DEFAULT_LANGUAGE;
};
