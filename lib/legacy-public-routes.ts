import { mockTerms } from '@/data/mockData';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import { normalizeLanguage, resolvePreferredLanguage } from '@/lib/language';
import { buildLocalePath } from '@/lib/seo-routing';
import type { Language } from '@/types';

type LegacyStaticPath = '/about' | '/methodology';

interface LegacyLocaleInput {
    readonly queryLanguage?: string | null;
    readonly cookieLanguage?: string | null;
    readonly acceptLanguage?: string | null;
}

interface LegacyTermRedirectInput extends LegacyLocaleInput {
    readonly termId: string;
}

const legacySeoTermSlugById = new Map(
    filterAcademicTerms(mockTerms).map((term) => [term.id, term.slug] as const)
);

export const resolveLegacyPublicLocale = ({
    queryLanguage,
    cookieLanguage,
    acceptLanguage,
}: LegacyLocaleInput): Language => (
    normalizeLanguage(queryLanguage)
    ?? resolvePreferredLanguage({
        cookieValue: cookieLanguage,
        acceptLanguage,
    })
);

export const buildLegacyStaticRedirectPath = (
    staticPath: LegacyStaticPath,
    localeInput: LegacyLocaleInput
): string => buildLocalePath(resolveLegacyPublicLocale(localeInput), staticPath);

export const getLegacySeoTermSlugById = (termId: string): string | null => (
    legacySeoTermSlugById.get(termId) ?? null
);

export const buildLegacyTermRedirectPath = ({
    termId,
    ...localeInput
}: LegacyTermRedirectInput): string | null => {
    const termSlug = getLegacySeoTermSlugById(termId);

    if (!termSlug) {
        return null;
    }

    return buildLocalePath(resolveLegacyPublicLocale(localeInput), `/glossary/${termSlug}`);
};
