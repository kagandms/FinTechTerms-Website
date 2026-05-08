import { notFound } from 'next/navigation';
import {
    getGlossaryLetterGroup,
    getLocalizedTermDefinition,
    getLocalizedTermLabel,
    listGlossaryLetterGroups,
} from '@/lib/public-seo-catalog';
import PublicSiblingLocaleLinks from '@/components/public-sibling-locale-links';
import { serializeJsonLd } from '@/lib/json-ld';
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd } from '@/lib/public-schema';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale, PUBLIC_LOCALES } from '@/lib/seo-routing';
import type { Language, Term } from '@/types';

const LETTER_SCHEMA_TERM_LIMIT = 100;

const pageCopy: Record<Language, {
    eyebrow: string;
    titleSuffix: string;
    descriptionPrefix: string;
    termsTitle: string;
    glossary: string;
}> = {
    en: {
        eyebrow: 'Glossary letter index',
        titleSuffix: 'fintech glossary terms',
        descriptionPrefix: 'Browse fintech glossary terms starting with',
        termsTitle: 'Terms in this letter group',
        glossary: 'Glossary',
    },
    ru: {
        eyebrow: 'Буквенный индекс глоссария',
        titleSuffix: 'термины финтех-глоссария',
        descriptionPrefix: 'Просматривайте термины финтех-глоссария, начинающиеся с',
        termsTitle: 'Термины этой буквенной группы',
        glossary: 'Глоссарий',
    },
    tr: {
        eyebrow: 'Sözlük harf indeksi',
        titleSuffix: 'fintek sözlük terimleri',
        descriptionPrefix: 'Şu harfle başlayan fintek sözlük terimlerini görüntüleyin:',
        termsTitle: 'Bu harf grubundaki terimler',
        glossary: 'Sözlük',
    },
};

export const dynamicParams = false;

const decodeGroupKey = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

export async function generateStaticParams(): Promise<Array<{ locale: Language; group: string }>> {
    const groupSets = await Promise.all(PUBLIC_LOCALES.map(async (locale) => (
        (await listGlossaryLetterGroups(locale)).map((group) => ({
            locale,
            group: group.key,
        }))
    )));

    return groupSets.flat();
}

const buildPageTitle = (groupLabel: string, locale: Language): string => (
    `${groupLabel} ${pageCopy[locale].titleSuffix}`
);

const buildPageDescription = (groupLabel: string, locale: Language): string => (
    `${pageCopy[locale].descriptionPrefix} ${groupLabel}.`
);

const buildDefinedTerm = (term: Term, locale: Language) => ({
    '@type': 'DefinedTerm',
    name: getLocalizedTermLabel(term, locale),
    description: getLocalizedTermDefinition(term, locale),
    url: buildAbsoluteUrl(buildLocalePath(locale, `/glossary/${term.slug}`)),
});

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; group: string }>;
}) {
    const { locale: rawLocale, group: groupKey } = await params;

    if (!isPublicLocale(rawLocale)) {
        return {};
    }

    const group = await getGlossaryLetterGroup(rawLocale, decodeGroupKey(groupKey));

    if (!group) {
        return {};
    }

    return buildSeoMetadata({
        locale: rawLocale,
        title: buildPageTitle(group.label, rawLocale),
        description: buildPageDescription(group.label, rawLocale),
        path: buildLocalePath(rawLocale, `/glossary/letter/${group.key}`),
    });
}

export default async function GlossaryLetterPage({
    params,
}: {
    params: Promise<{ locale: string; group: string }>;
}) {
    const { locale: rawLocale, group: groupKey } = await params;

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const locale = rawLocale;
    const group = await getGlossaryLetterGroup(locale, decodeGroupKey(groupKey));

    if (!group) {
        notFound();
    }

    const copy = pageCopy[locale];
    const title = buildPageTitle(group.label, locale);
    const description = buildPageDescription(group.label, locale);
    const schemaTerms = group.terms.slice(0, LETTER_SCHEMA_TERM_LIMIT);

    return (
        <div className="space-y-8">
            <PublicSiblingLocaleLinks currentLocale={locale} suffix={`/glossary/letter/${group.key}`} />

            <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-6 shadow-sm md:rounded-[2.5rem] md:px-10 md:py-10">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.eyebrow}
                </span>
                <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
                <a
                    href={buildLocalePath(locale, '/glossary')}
                    className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-950 hover:text-slate-950"
                >
                    {copy.glossary}
                </a>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-950">{copy.termsTitle}</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.terms.map((term) => (
                        <a
                            key={term.id}
                            href={buildLocalePath(locale, `/glossary/${term.slug}`)}
                            className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-900 hover:bg-slate-100"
                        >
                            <p className="text-lg font-semibold text-slate-950">{getLocalizedTermLabel(term, locale)}</p>
                            <p className="mt-2 text-base leading-7 text-slate-600">{getLocalizedTermDefinition(term, locale)}</p>
                        </a>
                    ))}
                </div>
            </section>

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: serializeJsonLd([
                        {
                            '@context': 'https://schema.org',
                            '@type': 'DefinedTermSet',
                            name: title,
                            description,
                            url: buildAbsoluteUrl(buildLocalePath(locale, `/glossary/letter/${group.key}`)),
                            inLanguage: locale,
                            numberOfItems: group.terms.length,
                            publisher: buildOrganizationJsonLd(locale),
                            hasDefinedTerm: schemaTerms.map((term) => buildDefinedTerm(term, locale)),
                        },
                        buildBreadcrumbJsonLd(locale, [
                            {
                                name: copy.glossary,
                                path: buildLocalePath(locale, '/glossary'),
                            },
                            {
                                name: title,
                                path: buildLocalePath(locale, `/glossary/letter/${group.key}`),
                            },
                        ]),
                    ]),
                }}
            />
        </div>
    );
}
