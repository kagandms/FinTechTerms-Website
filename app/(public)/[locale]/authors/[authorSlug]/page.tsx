import { notFound } from 'next/navigation';
import { getLocalizedTermLabel, getLocalizedText, getSeoContributorBySlug, listStaticContributorSlugs, listTermsByContributor } from '@/lib/public-seo-catalog';
import PublicSiblingLocaleLinks from '@/components/public-sibling-locale-links';
import { serializeJsonLd } from '@/lib/json-ld';
import { buildBreadcrumbJsonLd } from '@/lib/public-schema';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale, PUBLIC_LOCALES } from '@/lib/seo-routing';
import type { Contributor, Language } from '@/types';

const authorCopy: Record<Language, { expertise: string; disclosure: string; languages: string; credential: string; affiliation: string; written: string; reviewed: string }> = {
    en: { expertise: 'Expertise', disclosure: 'Disclosure', languages: 'Languages', credential: 'Credential', affiliation: 'Affiliation', written: 'Published terms', reviewed: 'Reviewed terms' },
    ru: { expertise: 'Экспертиза', disclosure: 'Раскрытие', languages: 'Языки', credential: 'Квалификация', affiliation: 'Аффилиация', written: 'Опубликованные термины', reviewed: 'Проверенные термины' },
    tr: { expertise: 'Uzmanlık', disclosure: 'Açıklama', languages: 'Diller', credential: 'Yetkinlik', affiliation: 'Bağlantı', written: 'Yayınlanan terimler', reviewed: 'İncelenen terimler' },
};

const authorMetadataCopy: Record<Language, { titleSuffix: string; descriptionPrefix: string }> = {
    en: { titleSuffix: 'editorial profile', descriptionPrefix: 'Editorial profile and reviewed glossary coverage for' },
    ru: { titleSuffix: 'редакционный профиль', descriptionPrefix: 'Редакционный профиль и проверенные страницы глоссария для' },
    tr: { titleSuffix: 'editoryal profil', descriptionPrefix: 'Editoryal profil ve incelenmiş sözlük kapsamı:' },
};

const buildAuthorMetadataTitle = (name: string, locale: Language): string => (
    `${name} ${authorMetadataCopy[locale].titleSuffix}`
);

const buildAuthorMetadataDescription = (
    name: string,
    title: string,
    locale: Language
): string => (
    `${authorMetadataCopy[locale].descriptionPrefix} ${name}. ${title}`
);

const buildContributorAffiliationJsonLd = (contributor: Contributor, locale: Language) => {
    if (!contributor.affiliation) {
        return undefined;
    }

    return {
        '@type': 'Organization',
        name: getLocalizedText(contributor.affiliation, locale),
        url: contributor.affiliationPath
            ? buildAbsoluteUrl(buildLocalePath(locale, contributor.affiliationPath))
            : buildAbsoluteUrl(buildLocalePath(locale)),
    };
};

const buildContributorCredentialJsonLd = (contributor: Contributor, locale: Language) => (
    contributor.credential ? {
        '@type': 'EducationalOccupationalCredential',
        name: getLocalizedText(contributor.credential, locale),
    } : undefined
);

const buildContributorJsonLd = (contributor: Contributor, locale: Language) => ({
    '@context': 'https://schema.org',
    '@type': contributor.kind === 'person' ? 'Person' : 'Organization',
    name: contributor.name,
    description: getLocalizedText(contributor.bio, locale),
    email: contributor.email,
    url: buildAbsoluteUrl(buildLocalePath(locale, `/authors/${contributor.slug}`)),
    sameAs: contributor.sameAs,
    knowsAbout: contributor.expertise,
    hasCredential: buildContributorCredentialJsonLd(contributor, locale),
    affiliation: buildContributorAffiliationJsonLd(contributor, locale),
    worksFor: contributor.kind === 'person' ? {
        '@type': 'Organization',
        name: contributor.organization,
        url: buildAbsoluteUrl(buildLocalePath(locale)),
    } : undefined,
});

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ locale: Language; authorSlug: string }>> {
    const contributorSlugs = await listStaticContributorSlugs();

    return PUBLIC_LOCALES.flatMap((locale) => (
        contributorSlugs.map((authorSlug) => ({ locale, authorSlug }))
    ));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; authorSlug: string }>;
}) {
    const { locale: rawLocale, authorSlug } = await params;

    if (!isPublicLocale(rawLocale)) {
        return {};
    }

    const contributor = await getSeoContributorBySlug(authorSlug);

    if (!contributor) {
        return {};
    }

    return buildSeoMetadata({
        locale: rawLocale,
        title: buildAuthorMetadataTitle(contributor.name, rawLocale),
        description: buildAuthorMetadataDescription(
            contributor.name,
            getLocalizedText(contributor.title, rawLocale),
            rawLocale
        ),
        path: buildLocalePath(rawLocale, `/authors/${contributor.slug}`),
    });
}

export default async function AuthorPage({
    params,
}: {
    params: Promise<{ locale: string; authorSlug: string }>;
}) {
    const { locale: rawLocale, authorSlug } = await params;

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const locale = rawLocale;
    const contributor = await getSeoContributorBySlug(authorSlug);

    if (!contributor) {
        notFound();
    }

    const copy = authorCopy[locale];
    const [writtenTerms, reviewedTerms] = await Promise.all([
        listTermsByContributor(contributor.id, 'author'),
        listTermsByContributor(contributor.id, 'reviewer'),
    ]);

    return (
        <div className="space-y-8">
            <PublicSiblingLocaleLinks currentLocale={locale} suffix={`/authors/${contributor.slug}`} />

            <div className="rounded-[2rem] border border-slate-200 bg-white px-5 py-6 shadow-sm md:rounded-[2.5rem] md:px-10 md:py-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{contributor.role}</p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{contributor.name}</h1>
                <p className="mt-4 text-lg leading-8 text-slate-600">{getLocalizedText(contributor.title, locale)}</p>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{getLocalizedText(contributor.bio, locale)}</p>

                <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.expertise}</h2>
                        <ul className="mt-4 space-y-2 text-base leading-7 text-slate-600">
                            {contributor.expertise.map((entry) => (
                                <li key={entry}>{entry}</li>
                            ))}
                        </ul>
                    </section>
                    <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.languages}</h2>
                        <p className="mt-4 text-base leading-7 text-slate-600">{contributor.languages.join(', ')}</p>
                    </section>
                    <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.disclosure}</h2>
                        <p className="mt-4 text-base leading-7 text-slate-600">{getLocalizedText(contributor.disclosure, locale)}</p>
                    </section>
                    {contributor.credential ? (
                        <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.credential}</h2>
                            <p className="mt-4 text-base leading-7 text-slate-600">{getLocalizedText(contributor.credential, locale)}</p>
                        </section>
                    ) : null}
                    {contributor.affiliation ? (
                        <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.affiliation}</h2>
                            {contributor.affiliationPath ? (
                                <a
                                    href={buildLocalePath(locale, contributor.affiliationPath)}
                                    className="mt-4 block text-base font-semibold leading-7 text-slate-700 hover:text-sky-700"
                                >
                                    {getLocalizedText(contributor.affiliation, locale)}
                                </a>
                            ) : (
                                <p className="mt-4 text-base leading-7 text-slate-600">{getLocalizedText(contributor.affiliation, locale)}</p>
                            )}
                        </section>
                    ) : null}
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                    <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.written}</h2>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {writtenTerms.slice(0, 12).map((term) => (
                                <a
                                    key={term.id}
                                    href={buildLocalePath(locale, `/glossary/${term.slug}`)}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-950"
                                >
                                    {getLocalizedTermLabel(term, locale)}
                                </a>
                            ))}
                        </div>
                    </section>
                    <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.reviewed}</h2>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {reviewedTerms.slice(0, 12).map((term) => (
                                <a
                                    key={term.id}
                                    href={buildLocalePath(locale, `/glossary/${term.slug}`)}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-950"
                                >
                                    {getLocalizedTermLabel(term, locale)}
                                </a>
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: serializeJsonLd([
                        buildContributorJsonLd(contributor, locale),
                        buildBreadcrumbJsonLd(locale, [{
                            name: contributor.name,
                            path: buildLocalePath(locale, `/authors/${contributor.slug}`),
                        }]),
                    ]),
                }}
            />
        </div>
    );
}
