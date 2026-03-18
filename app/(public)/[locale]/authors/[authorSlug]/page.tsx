import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLocalizedTermLabel, getLocalizedText, getSeoContributorBySlug, listStaticContributorSlugs, listTermsByContributor } from '@/lib/public-seo-catalog';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const authorCopy: Record<Language, { expertise: string; disclosure: string; languages: string; written: string; reviewed: string }> = {
    en: { expertise: 'Expertise', disclosure: 'Disclosure', languages: 'Languages', written: 'Published terms', reviewed: 'Reviewed terms' },
    ru: { expertise: 'Экспертиза', disclosure: 'Раскрытие', languages: 'Языки', written: 'Опубликованные термины', reviewed: 'Проверенные термины' },
    tr: { expertise: 'Uzmanlık', disclosure: 'Açıklama', languages: 'Diller', written: 'Yayınlanan terimler', reviewed: 'İncelenen terimler' },
};

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ authorSlug: string }>> {
    const contributorSlugs = await listStaticContributorSlugs();

    return contributorSlugs.map((authorSlug) => ({ authorSlug }));
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
        title: contributor.name,
        description: getLocalizedText(contributor.bio, rawLocale),
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
        <div className="rounded-[2.5rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{contributor.role}</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{contributor.name}</h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">{getLocalizedText(contributor.title, locale)}</p>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{getLocalizedText(contributor.bio, locale)}</p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
                <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.expertise}</h2>
                    <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                        {contributor.expertise.map((entry) => (
                            <li key={entry}>{entry}</li>
                        ))}
                    </ul>
                </section>
                <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.languages}</h2>
                    <p className="mt-4 text-sm leading-6 text-slate-600">{contributor.languages.join(', ')}</p>
                </section>
                <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.disclosure}</h2>
                    <p className="mt-4 text-sm leading-6 text-slate-600">{getLocalizedText(contributor.disclosure, locale)}</p>
                </section>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.written}</h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {writtenTerms.slice(0, 12).map((term) => (
                            <Link
                                key={term.id}
                                href={buildLocalePath(locale, `/glossary/${term.slug}`)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-950"
                            >
                                {getLocalizedTermLabel(term, locale)}
                            </Link>
                        ))}
                    </div>
                </section>
                <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.reviewed}</h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {reviewedTerms.slice(0, 12).map((term) => (
                            <Link
                                key={term.id}
                                href={buildLocalePath(locale, `/glossary/${term.slug}`)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-950"
                            >
                                {getLocalizedTermLabel(term, locale)}
                            </Link>
                        ))}
                    </div>
                </section>
            </div>

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': contributor.kind === 'person' ? 'Person' : 'Organization',
                        name: contributor.name,
                        description: getLocalizedText(contributor.bio, locale),
                        email: contributor.email,
                        worksFor: contributor.organization,
                        url: buildAbsoluteUrl(buildLocalePath(locale, `/authors/${contributor.slug}`)),
                    }),
                }}
            />
        </div>
    );
}
