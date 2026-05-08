import { getSiteUrl } from '@/lib/site-url';
import { SUPPORTED_LANGUAGES } from '@/lib/language';
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
    'x-default': getSiteUrl(),
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

const SEO_TITLE_SUFFIX = ' | FinTechTerms';
const MAX_SEO_TITLE_LENGTH = 60;
const MAX_SEO_TITLE_BASE_LENGTH = MAX_SEO_TITLE_LENGTH - SEO_TITLE_SUFFIX.length;
const MIN_WORD_SAFE_TITLE_LENGTH = 24;
const TRAILING_TITLE_STOPWORDS = /\s+(and|or|in|for|with|without|ve|veya|ile|için|и|или|для|с)$/i;
const TRAILING_TITLE_PUNCTUATION = /[\s,;:|-]+$/;

const normalizeTitleValue = (value: string): string => (
    value.trim().replace(/\s+/g, ' ')
);

const removeTitleSuffix = (value: string): string => (
    value.endsWith(SEO_TITLE_SUFFIX)
        ? value.slice(0, -SEO_TITLE_SUFFIX.length)
        : value
);

const cleanShortTitleBase = (value: string): string => (
    value.replace(TRAILING_TITLE_STOPWORDS, '').replace(TRAILING_TITLE_PUNCTUATION, '')
);

const shortenTitleBase = (value: string): string => {
    const normalizedValue = normalizeTitleValue(value);

    if (normalizedValue.length <= MAX_SEO_TITLE_BASE_LENGTH) {
        return normalizedValue;
    }

    const clippedValue = normalizedValue.slice(0, MAX_SEO_TITLE_BASE_LENGTH).trimEnd();
    const lastWordBreakIndex = clippedValue.lastIndexOf(' ');

    if (lastWordBreakIndex >= MIN_WORD_SAFE_TITLE_LENGTH) {
        return cleanShortTitleBase(clippedValue.slice(0, lastWordBreakIndex));
    }

    return cleanShortTitleBase(clippedValue);
};

export const formatSeoTitle = (value: string): string => (
    `${shortenTitleBase(removeTitleSuffix(value))}${SEO_TITLE_SUFFIX}`
);
