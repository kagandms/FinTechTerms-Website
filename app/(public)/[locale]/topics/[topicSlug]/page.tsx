import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocalizedTermDefinition, getLocalizedTermLabel, getLocalizedText, getSeoSourceById, getSeoTopicBySlug, listStaticTopicSlugs, listTopicTerms } from '@/lib/public-seo-catalog';
import { getScriptNonce } from '@/lib/script-nonce';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const topicCopy: Record<Language, { title: string; terms: string; sources: string }> = {
    en: { title: 'Topic hub', terms: 'Terms in this hub', sources: 'Source framework' },
    ru: { title: 'Тематический хаб', terms: 'Термины в этом хабе', sources: 'Источник и рамка' },
    tr: { title: 'Topic hub', terms: 'Bu hub içindeki terimler', sources: 'Kaynak çerçevesi' },
};

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ topicSlug: string }>> {
    const topicSlugs = await listStaticTopicSlugs();

    return topicSlugs.map((topicSlug) => ({ topicSlug }));
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
    const nonce = await getScriptNonce();

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const locale = rawLocale;
    const topic = await getSeoTopicBySlug(topicSlug);

    if (!topic) {
        notFound();
    }

    const [terms, sources] = await Promise.all([
        listTopicTerms(topic.id),
        Promise.all(topic.sourceIds.map(async (sourceId) => getSeoSourceById(sourceId))).then((items) => (
            items.filter((item): item is NonNullable<typeof items[number]> => Boolean(item))
        )),
    ]);
    const copy = topicCopy[locale];

    return (
        <div className="space-y-8">
            <section className="rounded-[2.5rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.title}
                </span>
                <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
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
                                <p className="mt-2 text-sm leading-6 text-slate-600">{getLocalizedText(source.note, locale)}</p>
                            </a>
                        ))}
                    </div>
                </section>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-950">{copy.terms}</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {terms.map((term) => (
                        <Link
                            key={term.id}
                            href={buildLocalePath(locale, `/glossary/${term.slug}`)}
                            className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-900 hover:bg-slate-100"
                        >
                            <p className="text-lg font-semibold text-slate-950">{getLocalizedTermLabel(term, locale)}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{getLocalizedTermDefinition(term, locale)}</p>
                        </Link>
                    ))}
                </div>
            </section>

            <script
                nonce={nonce}
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
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
                    }),
                }}
            />
        </div>
    );
}
