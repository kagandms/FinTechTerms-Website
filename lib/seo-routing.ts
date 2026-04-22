import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';
import { SUPPORTED_LANGUAGES } from '@/lib/language';
import type { Language } from '@/types';

const OG_LOCALES: Record<Language, 'en_US' | 'ru_RU' | 'tr_TR'> = {
    en: 'en_US',
    ru: 'ru_RU',
    tr: 'tr_TR',
};

export const PUBLIC_LOCALES: readonly Language[] = SUPPORTED_LANGUAGES;

export const isPublicLocale = (value: string): value is Language => (
    PUBLIC_LOCALES.includes(value as Language)
);

export const buildLocalePath = (locale: Language, suffix = ''): string => {
    if (!suffix) {
        return `/${locale}`;
    }

    return `/${locale}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
};

export const buildSiblingLocalePath = (
    pathname: string | null | undefined,
    targetLocale: Language
): string => {
    if (!pathname) {
        return buildLocalePath(targetLocale);
    }

    const segments = pathname.split('/');
    const currentLocale = segments[1] ?? '';

    if (!isPublicLocale(currentLocale)) {
        return buildLocalePath(targetLocale);
    }

    segments[1] = targetLocale;
    const rewrittenPath = segments.join('/');

    return rewrittenPath || buildLocalePath(targetLocale);
};

export const buildLocaleAlternates = (suffix = ''): NonNullable<Metadata['alternates']>['languages'] => ({
    ru: buildLocalePath('ru', suffix),
    en: buildLocalePath('en', suffix),
    tr: buildLocalePath('tr', suffix),
});

export const buildAbsoluteLocaleAlternates = (suffix = ''): NonNullable<Metadata['alternates']>['languages'] => ({
    ru: buildAbsoluteUrl(buildLocalePath('ru', suffix)),
    en: buildAbsoluteUrl(buildLocalePath('en', suffix)),
    tr: buildAbsoluteUrl(buildLocalePath('tr', suffix)),
});

export const buildXDefaultAlternates = (): NonNullable<Metadata['alternates']>['languages'] => ({
    'x-default': '/',
    ...buildLocaleAlternates(),
});

export const buildAbsoluteXDefaultAlternates = (): NonNullable<Metadata['alternates']>['languages'] => ({
    'x-default': getSiteUrl(),
    ...buildAbsoluteLocaleAlternates(),
});

export const buildAbsoluteUrl = (path: string): string => `${getSiteUrl()}${path}`;

export const getOpenGraphLocale = (locale: Language): 'en_US' | 'ru_RU' | 'tr_TR' => (
    OG_LOCALES[locale]
);

export const formatSeoTitle = (value: string): string => (
    value.endsWith(' | FinTechTerms')
        ? value
        : `${value} | FinTechTerms`
);
