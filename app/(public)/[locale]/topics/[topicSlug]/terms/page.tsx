import { notFound } from 'next/navigation';
import {
    getLocalizedTermDefinition,
    getLocalizedTermLabel,
    getLocalizedText,
    getSeoTopicBySlug,
    listStaticTopicSlugs,
    listTopicTerms,
} from '@/lib/public-seo-catalog';
import PublicSiblingLocaleLinks from '@/components/public-sibling-locale-links';
import { serializeJsonLd } from '@/lib/json-ld';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale, PUBLIC_LOCALES } from '@/lib/seo-routing';
import type { Language, Term, Topic } from '@/types';

const topicTermsCopy: Record<Language, {
    eyebrow: string;
    titleSuffix: string;
    descriptionPrefix: string;
    backToHub: string;
}> = {
    en: {
        eyebrow: 'Topic term index',
        titleSuffix: 'terms',
        descriptionPrefix: 'Full crawlable term index for',
        backToHub: 'Back to topic hub',
    },
    ru: {
        eyebrow: 'Индекс терминов темы',
        titleSuffix: 'термины',
        descriptionPrefix: 'Полный сканируемый индекс терминов для темы',
        backToHub: 'Вернуться к хабу',
    },
    tr: {
        eyebrow: 'Topic terim indeksi',
        titleSuffix: 'terimleri',
        descriptionPrefix: 'Şu topic için tam ve taranabilir terim indeksi:',
        backToHub: 'Topic hub’a dön',
    },
};

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ locale: Language; topicSlug: string }>> {
    const topicSlugs = await listStaticTopicSlugs();

    return PUBLIC_LOCALES.flatMap((locale) => (
        topicSlugs.map((topicSlug) => ({ locale, topicSlug }))
    ));
}

const buildPageTitle = (topic: Topic, locale: Language): string => {
    const copy = topicTermsCopy[locale];

    return `${getLocalizedText(topic.title, locale)} ${copy.titleSuffix}`;
};

const buildPageDescription = (topic: Topic, locale: Language): string => {
    const copy = topicTermsCopy[locale];

    return `${copy.descriptionPrefix} ${getLocalizedText(topic.title, locale).toLowerCase()}.`;
};

const buildTermItem = (term: Term, locale: Language, position: number) => ({
    '@type': 'ListItem',
    position,
    url: buildAbsoluteUrl(buildLocalePath(locale, `/glossary/${term.slug}`)),
    name: getLocalizedTermLabel(term, locale),
});

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
        title: buildPageTitle(topic, rawLocale),
        description: buildPageDescription(topic, rawLocale),
        path: buildLocalePath(rawLocale, `/topics/${topic.slug}/terms`),
    });
}

export default async function TopicTermsPage({
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

    const terms = await listTopicTerms(topic.id);
    const copy = topicTermsCopy[locale];
    const title = buildPageTitle(topic, locale);
    const description = buildPageDescription(topic, locale);

    return (
        <div className="space-y-8">
            <PublicSiblingLocaleLinks currentLocale={locale} suffix={`/topics/${topic.slug}/terms`} />

            <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-6 shadow-sm md:rounded-[2.5rem] md:px-10 md:py-10">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.eyebrow}
                </span>
                <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
                <a
                    href={buildLocalePath(locale, `/topics/${topic.slug}`)}
                    className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-950 hover:text-slate-950"
                >
                    {copy.backToHub}
                </a>
            </section>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {terms.map((term) => (
                    <a
                        key={term.id}
                        href={buildLocalePath(locale, `/glossary/${term.slug}`)}
                        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-900 hover:bg-slate-50"
                    >
                        <p className="text-lg font-semibold text-slate-950">{getLocalizedTermLabel(term, locale)}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{getLocalizedTermDefinition(term, locale)}</p>
                    </a>
                ))}
            </section>

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: serializeJsonLd({
                        '@context': 'https://schema.org',
                        '@type': 'CollectionPage',
                        name: title,
                        description,
                        url: buildAbsoluteUrl(buildLocalePath(locale, `/topics/${topic.slug}/terms`)),
                        inLanguage: locale,
                        isPartOf: {
                            '@type': 'CollectionPage',
                            name: getLocalizedText(topic.title, locale),
                            url: buildAbsoluteUrl(buildLocalePath(locale, `/topics/${topic.slug}`)),
                        },
                        mainEntity: {
                            '@type': 'ItemList',
                            numberOfItems: terms.length,
                            itemListElement: terms.map((term, index) => buildTermItem(term, locale, index + 1)),
                        },
                    }),
                }}
            />
        </div>
    );
}
