import { notFound } from 'next/navigation';
import {
    getLocalizedTermDefinition,
    getLocalizedTermLabel,
    getLocalizedTermSeoDescription,
    getLocalizedTermSeoTitle,
    getLocalizedText,
    getComparisonTerm,
    getPrerequisiteTerm,
    getSeoContributorById,
    getSeoSourceById,
    getSeoTermBySlug,
    getSeoTopicById,
    listStaticPriorityTermSlugs,
    listRelatedTerms,
} from '@/lib/public-seo-catalog';
import PublicSeoHeroMark from '@/components/public-seo-hero-mark';
import { serializeJsonLd } from '@/lib/json-ld';
import { getScriptNonce } from '@/lib/script-nonce';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import { formatUtcDateForLocale } from '@/lib/time';
import type { Contributor, Language, SourceRef, Term, Topic } from '@/types';

const termCopy: Record<Language, {
    glossary: string;
    topic: string;
    whyItMatters: string;
    howItWorks: string;
    risks: string;
    regionalNotes: string;
    comparison: string;
    prerequisite: string;
    relatedTerms: string;
    sources: string;
    author: string;
    reviewer: string;
    reviewedAt: string;
    disclaimer: string;
}> = {
    en: {
        glossary: 'Glossary',
        topic: 'Topic',
        whyItMatters: 'Why it matters',
        howItWorks: 'How it works',
        risks: 'Risks and pitfalls',
        regionalNotes: 'Regional notes',
        comparison: 'Compare with',
        prerequisite: 'Build from',
        relatedTerms: 'Related terms',
        sources: 'Primary sources',
        author: 'Author',
        reviewer: 'Reviewer',
        reviewedAt: 'Reviewed',
        disclaimer: 'Educational content only. This page does not provide investment, legal, or regulatory advice.',
    },
    ru: {
        glossary: 'Глоссарий',
        topic: 'Тема',
        whyItMatters: 'Почему это важно',
        howItWorks: 'Как это работает',
        risks: 'Риски и типичные ошибки',
        regionalNotes: 'Региональные заметки',
        comparison: 'Сравнить с',
        prerequisite: 'Предпосылка',
        relatedTerms: 'Связанные термины',
        sources: 'Первичные источники',
        author: 'Автор',
        reviewer: 'Ревьюер',
        reviewedAt: 'Проверено',
        disclaimer: 'Материал носит образовательный характер и не является инвестиционной, юридической или регуляторной рекомендацией.',
    },
    tr: {
        glossary: 'Sözlük',
        topic: 'Konu',
        whyItMatters: 'Neden önemli',
        howItWorks: 'Nasıl çalışır',
        risks: 'Riskler ve tipik hatalar',
        regionalNotes: 'Bölgesel notlar',
        comparison: 'Bununla karşılaştır',
        prerequisite: 'Önkoşul',
        relatedTerms: 'İlgili terimler',
        sources: 'Birincil kaynaklar',
        author: 'Yazar',
        reviewer: 'İnceleyen',
        reviewedAt: 'Gözden geçirildi',
        disclaimer: 'Bu içerik yalnızca eğitseldir; yatırım, hukuk veya regülasyon tavsiyesi sunmaz.',
    },
};

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
    const priorityTermSlugs = await listStaticPriorityTermSlugs();

    return priorityTermSlugs.map((slug) => ({ slug }));
}

const getPrimaryTopic = async (term: Term): Promise<Topic | null> => {
    const topicId = term.topic_ids[0];

    if (!topicId) {
        return null;
    }

    return getSeoTopicById(topicId);
};

const getLocalizedSection = (value: Term['expanded_definition'], locale: Language): string => (
    value[locale] || value.en || value.ru || value.tr
);

const loadTermDependencies = async (term: Term): Promise<{
    relatedTerms: readonly Term[];
    comparisonTerm: Term | null;
    prerequisiteTerm: Term | null;
    author: Contributor | null;
    reviewer: Contributor | null;
    sources: readonly SourceRef[];
}> => {
    const [relatedTerms, comparisonTerm, prerequisiteTerm, author, reviewer, sources] = await Promise.all([
        listRelatedTerms(term),
        getComparisonTerm(term),
        getPrerequisiteTerm(term),
        getSeoContributorById(term.author_id),
        getSeoContributorById(term.reviewer_id),
        Promise.all(term.source_refs.map(async (sourceId) => getSeoSourceById(sourceId))).then((items) => (
            items.filter((item): item is SourceRef => Boolean(item))
        )),
    ]);

    return {
        relatedTerms,
        comparisonTerm,
        prerequisiteTerm,
        author,
        reviewer,
        sources,
    };
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}) {
    const { locale: rawLocale, slug } = await params;

    if (!isPublicLocale(rawLocale)) {
        return {};
    }

    const term = await getSeoTermBySlug(slug);

    if (!term) {
        return {};
    }

    return buildSeoMetadata({
        locale: rawLocale,
        title: getLocalizedTermSeoTitle(term, rawLocale),
        description: getLocalizedTermSeoDescription(term, rawLocale),
        path: buildLocalePath(rawLocale, `/glossary/${term.slug}`),
        type: 'article',
        imagePath: buildLocalePath(rawLocale, `/glossary/${term.slug}/opengraph-image`),
    });
}

export default async function SeoTermPage({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}) {
    const { locale: rawLocale, slug } = await params;
    const nonce = await getScriptNonce();

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const term = await getSeoTermBySlug(slug);

    if (!term) {
        notFound();
    }

    const locale = rawLocale;
    const copy = termCopy[locale];
    const [dependencies, primaryTopic] = await Promise.all([
        loadTermDependencies(term),
        getPrimaryTopic(term),
    ]);
    const termLabel = getLocalizedTermLabel(term, locale);
    const definition = getLocalizedTermDefinition(term, locale);
    const canonicalPath = buildLocalePath(locale, `/glossary/${term.slug}`);
    const breadcrumbItems = [
        { name: 'FinTechTerms', url: buildLocalePath(locale) },
        { name: copy.glossary, url: buildLocalePath(locale, '/glossary') },
        ...(primaryTopic ? [{ name: getLocalizedText(primaryTopic.title, locale), url: buildLocalePath(locale, `/topics/${primaryTopic.slug}`) }] : []),
        { name: termLabel, url: canonicalPath },
    ];

    return (
        <article className="space-y-14 md:space-y-8">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {breadcrumbItems.map((item, index) => (
                    <span key={item.url} className="inline-flex items-center gap-2">
                        {index === breadcrumbItems.length - 1 ? (
                            <span className="font-semibold text-slate-950">{item.name}</span>
                        ) : (
                            <a href={item.url} className="hover:text-slate-950">{item.name}</a>
                        )}
                        {index < breadcrumbItems.length - 1 ? <span>/</span> : null}
                    </span>
                ))}
            </nav>

            <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-6 shadow-sm md:rounded-[2.5rem] md:px-10 md:py-8">
                <PublicSeoHeroMark />
                <div className="flex flex-wrap items-center gap-2">
                    {primaryTopic ? (
                        <a
                            href={buildLocalePath(locale, `/topics/${primaryTopic.slug}`)}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700"
                        >
                            {copy.topic}: {getLocalizedText(primaryTopic.title, locale)}
                        </a>
                    ) : null}
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {term.primary_market}
                    </span>
                </div>
                <h1 className="mt-4 line-clamp-1 text-lg font-black leading-tight tracking-tight text-slate-950 sm:line-clamp-none sm:text-5xl">{termLabel}</h1>
                <p className="mt-3 line-clamp-1 max-w-3xl text-sm leading-6 text-slate-600 sm:line-clamp-none sm:text-lg sm:leading-8">{definition}</p>
            </section>

            <aside className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 sm:text-sm sm:leading-6">
                {copy.disclaimer}
            </aside>

            <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="space-y-4">
                    {[
                        { title: copy.whyItMatters, content: getLocalizedSection(term.why_it_matters, locale) },
                        { title: copy.howItWorks, content: getLocalizedSection(term.how_it_works, locale) },
                        { title: copy.risks, content: getLocalizedSection(term.risks_and_pitfalls, locale) },
                        { title: copy.regionalNotes, content: getLocalizedSection(term.regional_notes, locale) },
                    ].map((section) => (
                        <section key={section.title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-2xl font-bold text-slate-950">{section.title}</h2>
                            <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600 sm:line-clamp-none sm:text-base sm:leading-8">{section.content}</p>
                        </section>
                    ))}
                </div>

                <div className="space-y-4">
                    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-2xl font-bold text-slate-950">{copy.relatedTerms}</h2>
                        {dependencies.comparisonTerm ? (
                            <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.comparison}</p>
                                <a
                                    href={buildLocalePath(locale, `/glossary/${dependencies.comparisonTerm.slug}`)}
                                    className="mt-2 block text-lg font-semibold text-slate-950 hover:text-sky-700"
                                >
                                    {getLocalizedTermLabel(dependencies.comparisonTerm, locale)}
                                </a>
                            </div>
                        ) : null}
                        {dependencies.prerequisiteTerm ? (
                            <div className="mt-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.prerequisite}</p>
                                <a
                                    href={buildLocalePath(locale, `/glossary/${dependencies.prerequisiteTerm.slug}`)}
                                    className="mt-2 block text-lg font-semibold text-slate-950 hover:text-sky-700"
                                >
                                    {getLocalizedTermLabel(dependencies.prerequisiteTerm, locale)}
                                </a>
                            </div>
                        ) : null}
                        <div className="mt-4 space-y-3">
                            {dependencies.relatedTerms.map((relatedTerm) => (
                                <a
                                    key={relatedTerm.id}
                                    href={buildLocalePath(locale, `/glossary/${relatedTerm.slug}`)}
                                    className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-900 hover:bg-slate-100"
                                >
                                    <p className="text-lg font-semibold text-slate-950">{getLocalizedTermLabel(relatedTerm, locale)}</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{getLocalizedTermDefinition(relatedTerm, locale)}</p>
                                </a>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-2xl font-bold text-slate-950">{copy.sources}</h2>
                        <div className="mt-4 space-y-3">
                            {dependencies.sources.map((source) => (
                                <a
                                    key={source.id}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-900 hover:bg-slate-100"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{source.publisher}</p>
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                                            {source.last_verified}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-lg font-semibold text-slate-950">{getLocalizedText(source.title, locale)}</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{getLocalizedText(source.note, locale)}</p>
                                </a>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="space-y-4">
                            {dependencies.author ? (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.author}</p>
                                    <a href={buildLocalePath(locale, `/authors/${dependencies.author.slug}`)} className="mt-2 block text-lg font-semibold text-slate-950 hover:text-sky-700">
                                        {dependencies.author.name}
                                    </a>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{getLocalizedText(dependencies.author.title, locale)}</p>
                                </div>
                            ) : null}
                            {dependencies.reviewer ? (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.reviewer}</p>
                                    <a href={buildLocalePath(locale, `/authors/${dependencies.reviewer.slug}`)} className="mt-2 block text-lg font-semibold text-slate-950 hover:text-sky-700">
                                        {dependencies.reviewer.name}
                                    </a>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{getLocalizedText(dependencies.reviewer.title, locale)}</p>
                                </div>
                            ) : null}
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.reviewedAt}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{formatUtcDateForLocale(term.reviewed_at, locale)}</p>
                            </div>
                        </div>
                    </section>
                </div>
            </section>

            <script
                nonce={nonce}
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: serializeJsonLd([
                        {
                            '@context': 'https://schema.org',
                            '@type': 'DefinedTerm',
                            name: termLabel,
                            alternateName: [term.term_en, term.term_ru, term.term_tr],
                            description: definition,
                            termCode: term.id,
                            inDefinedTermSet: {
                                '@type': 'DefinedTermSet',
                                name: 'FinTechTerms',
                                url: buildAbsoluteUrl(buildLocalePath(locale, '/glossary')),
                            },
                            url: buildAbsoluteUrl(canonicalPath),
                            mainEntityOfPage: buildAbsoluteUrl(canonicalPath),
                        },
                        {
                            '@context': 'https://schema.org',
                            '@type': 'WebPage',
                            name: termLabel,
                            description: definition,
                            url: buildAbsoluteUrl(canonicalPath),
                            about: {
                                '@type': 'Thing',
                                name: termLabel,
                            },
                            author: dependencies.author ? {
                                '@type': dependencies.author.kind === 'person' ? 'Person' : 'Organization',
                                name: dependencies.author.name,
                                url: buildAbsoluteUrl(buildLocalePath(locale, `/authors/${dependencies.author.slug}`)),
                            } : undefined,
                            reviewedBy: dependencies.reviewer ? {
                                '@type': dependencies.reviewer.kind === 'person' ? 'Person' : 'Organization',
                                name: dependencies.reviewer.name,
                                url: buildAbsoluteUrl(buildLocalePath(locale, `/authors/${dependencies.reviewer.slug}`)),
                            } : undefined,
                        },
                        {
                            '@context': 'https://schema.org',
                            '@type': 'BreadcrumbList',
                            itemListElement: breadcrumbItems.map((item, index) => ({
                                '@type': 'ListItem',
                                position: index + 1,
                                name: item.name,
                                item: buildAbsoluteUrl(item.url),
                            })),
                        },
                    ]),
                }}
            />
        </article>
    );
}
