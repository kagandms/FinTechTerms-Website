import { getSiteUrl } from '@/lib/site-url';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '@/lib/language';
import type { Language } from '@/types';

const OG_LOCALES: Record<Language, 'en_US' | 'ru_RU' | 'tr_TR'> = {
    en: 'en_US',
    ru: 'ru_RU',
    tr: 'tr_TR',
};

const GLOSSARY_OPEN_GRAPH_IMAGE_ROUTE = 'opengraph-image-1miyui';
const PUBLIC_OPEN_GRAPH_IMAGE_ROUTE = 'opengraph-image-o1kegr';

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

export const buildLocaleAlternates = (suffix = ''): Record<Language, string> => ({
    ru: buildLocalePath('ru', suffix),
    en: buildLocalePath('en', suffix),
    tr: buildLocalePath('tr', suffix),
});

export const buildAbsoluteLocaleAlternates = (suffix = ''): Record<Language, string> => ({
    ru: buildAbsoluteUrl(buildLocalePath('ru', suffix)),
    en: buildAbsoluteUrl(buildLocalePath('en', suffix)),
    tr: buildAbsoluteUrl(buildLocalePath('tr', suffix)),
});

export const buildAbsolutePublicLocaleAlternates = (suffix = ''): Record<Language | 'x-default', string> => ({
    'x-default': suffix
        ? buildAbsoluteUrl(buildLocalePath(DEFAULT_LANGUAGE, suffix))
        : getSiteUrl(),
    ...buildAbsoluteLocaleAlternates(suffix),
});

export const buildXDefaultAlternates = (): Record<Language | 'x-default', string> => ({
    'x-default': '/',
    ...buildLocaleAlternates(),
});

export const buildAbsoluteXDefaultAlternates = (): Record<Language | 'x-default', string> => ({
    'x-default': getSiteUrl(),
    ...buildAbsoluteLocaleAlternates(),
});

export const buildAbsoluteUrl = (path: string): string => `${getSiteUrl()}${path}`;

export const buildGlossaryOpenGraphImagePath = (locale: Language, slug: string): string => (
    buildLocalePath(locale, `/glossary/${slug}/${GLOSSARY_OPEN_GRAPH_IMAGE_ROUTE}`)
);

export const buildPublicOpenGraphImagePath = (locale: Language): string => (
    buildLocalePath(locale, `/${PUBLIC_OPEN_GRAPH_IMAGE_ROUTE}`)
);

export const getOpenGraphLocale = (locale: Language): 'en_US' | 'ru_RU' | 'tr_TR' => (
    OG_LOCALES[locale]
);

export const formatSeoTitle = (value: string): string => (
    value.endsWith(' | FinTechTerms')
        ? value
        : `${value} | FinTechTerms`
);
