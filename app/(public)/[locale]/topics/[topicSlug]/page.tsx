import { notFound } from 'next/navigation';
import { getLocalizedTermDefinition, getLocalizedTermLabel, getLocalizedText, getSeoSourceById, getSeoTopicBySlug, listStaticTopicSlugs, listTopicTerms } from '@/lib/public-seo-catalog';
import PublicSeoHeroMark from '@/components/public-seo-hero-mark';
import PublicSiblingLocaleLinks from '@/components/public-sibling-locale-links';
import { serializeJsonLd } from '@/lib/json-ld';
import { buildBreadcrumbJsonLd } from '@/lib/public-schema';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale, PUBLIC_LOCALES } from '@/lib/seo-routing';
import type { Language, Term, Topic } from '@/types';

const TOPIC_TERM_PREVIEW_LIMIT = 24;

const topicCopy: Record<Language, { title: string; terms: string; sources: string; browseAll: string }> = {
    en: { title: 'Topic hub', terms: 'Core terms in this hub', sources: 'Source framework', browseAll: 'Browse all topic terms' },
    ru: { title: 'Тематический хаб', terms: 'Ключевые термины хаба', sources: 'Источник и рамка', browseAll: 'Открыть все термины темы' },
    tr: { title: 'Topic hub', terms: 'Hub içindeki temel terimler', sources: 'Kaynak çerçevesi', browseAll: 'Tüm topic terimlerini aç' },
};

export const dynamicParams = false;

const buildTopicTermPreview = (terms: readonly Term[], topic: Topic): readonly Term[] => {
    const termBySlug = new Map(terms.map((term) => [term.slug, term] as const));
    const priorityTerms = topic.priorityTermSlugs
        .map((slug) => termBySlug.get(slug))
        .filter((term): term is Term => Boolean(term));
    const priorityTermIds = new Set(priorityTerms.map((term) => term.id));
    const fallbackTerms = terms.filter((term) => !priorityTermIds.has(term.id));

    return [...priorityTerms, ...fallbackTerms].slice(0, TOPIC_TERM_PREVIEW_LIMIT);
};

export async function generateStaticParams(): Promise<Array<{ locale: Language; topicSlug: string }>> {
    const topicSlugs = await listStaticTopicSlugs();

    return PUBLIC_LOCALES.flatMap((locale) => (
        topicSlugs.map((topicSlug) => ({ locale, topicSlug }))
    ));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; topicSlug: string }>;
}) {
    const { locale: rawLocale, topicSlug } = await params;

    if (!isPublicLocale(rawLocale)) {
        return {};
    }

    const topic = await getSeoTopicBySlug(topicSlug);

    if (!topic) {
        return {};
    }

    return buildSeoMetadata({
        locale: rawLocale,
        title: getLocalizedText(topic.title, rawLocale),
        description: getLocalizedText(topic.description, rawLocale),
        path: buildLocalePath(rawLocale, `/topics/${topic.slug}`),
    });
}

export default async function TopicPage({
    params,
}: {
    params: Promise<{ locale: string; topicSlug: string }>;
}) {
    const { locale: rawLocale, topicSlug } = await params;

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const locale = rawLocale;
    const topic = await getSeoTopicBySlug(topicSlug);

    if (!topic) {
        notFound();
    }

    const [topicTerms, sources] = await Promise.all([
        listTopicTerms(topic.id),
        Promise.all(topic.sourceIds.map(async (sourceId) => getSeoSourceById(sourceId))).then((items) => (
            items.filter((item): item is NonNullable<typeof items[number]> => Boolean(item))
        )),
    ]);
    const copy = topicCopy[locale];
    const terms = buildTopicTermPreview(topicTerms, topic);

    return (
        <div className="space-y-14 md:space-y-8">
            <PublicSiblingLocaleLinks currentLocale={locale} suffix={`/topics/${topic.slug}`} />

            <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-6 shadow-sm md:rounded-[2.5rem] md:px-10 md:py-10">
                <PublicSeoHeroMark />
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.title}
                </span>
                <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
                    {getLocalizedText(topic.title, locale)}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                    {getLocalizedText(topic.hero, locale)}
                </p>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr,0.9fr]">
                <div className="space-y-4">
                    {topic.sections.map((section) => (
                        <article key={getLocalizedText(section.title, locale)} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-2xl font-bold text-slate-950">{getLocalizedText(section.title, locale)}</h2>
                            <p className="mt-4 text-base leading-8 text-slate-600">{getLocalizedText(section.body, locale)}</p>
                        </article>
                    ))}
                </div>

                <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-950">{copy.sources}</h2>
                    <div className="mt-4 space-y-3">
                        {sources.map((source) => (
                            <a
                                key={source.id}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-900 hover:bg-slate-100"
                            >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{source.publisher}</p>
                                <p className="mt-1 text-lg font-semibold text-slate-950">{getLocalizedText(source.title, locale)}</p>
                                <p className="mt-2 text-base leading-7 text-slate-600">{getLocalizedText(source.note, locale)}</p>
                            </a>
                        ))}
                    </div>
                </section>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-950">{copy.terms}</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {terms.map((term) => (
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
                <a
                    href={buildLocalePath(locale, `/topics/${topic.slug}/terms`)}
                    className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-950 hover:text-slate-950"
                >
                    {copy.browseAll}
                </a>
            </section>

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: serializeJsonLd([
                        {
                            '@context': 'https://schema.org',
                            '@type': 'CollectionPage',
                            name: getLocalizedText(topic.title, locale),
                            description: getLocalizedText(topic.description, locale),
                            url: buildAbsoluteUrl(buildLocalePath(locale, `/topics/${topic.slug}`)),
                            mainEntity: {
                                '@type': 'ItemList',
                                itemListElement: terms.map((term, index) => ({
                                    '@type': 'ListItem',
                                    position: index + 1,
                                    url: buildAbsoluteUrl(buildLocalePath(locale, `/glossary/${term.slug}`)),
                                    name: getLocalizedTermLabel(term, locale),
                                })),
                            },
                        },
                        buildBreadcrumbJsonLd(locale, [{
                            name: getLocalizedText(topic.title, locale),
                            path: buildLocalePath(locale, `/topics/${topic.slug}`),
                        }]),
                    ]),
                }}
            />
        </div>
    );
}
