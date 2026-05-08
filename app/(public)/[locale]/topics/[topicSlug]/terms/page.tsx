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
import { buildBreadcrumbJsonLd } from '@/lib/public-schema';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale, PUBLIC_LOCALES } from '@/lib/seo-routing';
import type { Language, Term, Topic } from '@/types';

const TOPIC_TERM_SCHEMA_LIMIT = 100;
const MAX_TOPIC_DESCRIPTION_LENGTH = 155;
const MIN_DESCRIPTION_BREAK_LENGTH = 110;

const topicTermsCopy: Record<Language, {
    eyebrow: string;
    titleSuffix: string;
    descriptionPrefix: string;
    backToHub: string;
    allTermsTitle: string;
    allTermsIntro: string;
}> = {
    en: {
        eyebrow: 'Topic term index',
        titleSuffix: 'terms',
        descriptionPrefix: 'Full crawlable term index for',
        backToHub: 'Back to topic hub',
        allTermsTitle: 'All terms in this topic',
        allTermsIntro: 'Crawlable links to every glossary page assigned to this topic.',
    },
    ru: {
        eyebrow: 'Индекс терминов темы',
        titleSuffix: 'термины',
        descriptionPrefix: 'Полный сканируемый индекс терминов для темы',
        backToHub: 'Вернуться к хабу',
        allTermsTitle: 'Все термины этой темы',
        allTermsIntro: 'Сканируемые ссылки на все страницы глоссария, закреплённые за этой темой.',
    },
    tr: {
        eyebrow: 'Konu terim indeksi',
        titleSuffix: 'terimleri',
        descriptionPrefix: 'Bu konu için tam ve taranabilir terim indeksi:',
        backToHub: 'Konu merkezine dön',
        allTermsTitle: 'Bu konudaki tüm terimler',
        allTermsIntro: 'Bu konuya bağlı tüm sözlük sayfaları için taranabilir bağlantılar.',
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

const trimPageDescription = (value: string): string => {
    const normalizedValue = value.trim().replace(/\s+/g, ' ');

    if (normalizedValue.length <= MAX_TOPIC_DESCRIPTION_LENGTH) {
        return normalizedValue;
    }

    const clippedValue = normalizedValue.slice(0, MAX_TOPIC_DESCRIPTION_LENGTH).trimEnd();
    const lastWordBreakIndex = clippedValue.lastIndexOf(' ');
    const trimmedValue = lastWordBreakIndex >= MIN_DESCRIPTION_BREAK_LENGTH
        ? clippedValue.slice(0, lastWordBreakIndex)
        : clippedValue;

    return `${trimmedValue.replace(/[\s,;:|-]+$/, '')}.`;
};

const buildPageDescription = (topic: Topic, locale: Language): string => {
    const copy = topicTermsCopy[locale];
    const topicTitle = getLocalizedText(topic.title, locale).toLowerCase();
    const topicDescription = getLocalizedText(topic.description, locale);

    return trimPageDescription(`${copy.descriptionPrefix} ${topicTitle}: ${topicDescription}`);
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
    const schemaTerms = terms.slice(0, TOPIC_TERM_SCHEMA_LIMIT);

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

            <section className="grid gap-4 lg:grid-cols-2">
                {topic.sections.map((section) => (
                    <article
                        key={getLocalizedText(section.title, locale)}
                        className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                    >
                        <h2 className="text-2xl font-bold text-slate-950">{getLocalizedText(section.title, locale)}</h2>
                        <p className="mt-4 text-base leading-8 text-slate-600">{getLocalizedText(section.body, locale)}</p>
                    </article>
                ))}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="max-w-3xl">
                    <h2 className="text-2xl font-bold text-slate-950">{copy.allTermsTitle}</h2>
                    <p className="mt-3 text-base leading-7 text-slate-600">{copy.allTermsIntro}</p>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {terms.map((term) => (
                    <a
                        key={term.id}
                        href={buildLocalePath(locale, `/glossary/${term.slug}`)}
                        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-900 hover:bg-slate-50"
                    >
                        <p className="text-lg font-semibold text-slate-950">{getLocalizedTermLabel(term, locale)}</p>
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
                                itemListElement: schemaTerms.map((term, index) => buildTermItem(term, locale, index + 1)),
                            },
                        },
                        buildBreadcrumbJsonLd(locale, [
                            {
                                name: getLocalizedText(topic.title, locale),
                                path: buildLocalePath(locale, `/topics/${topic.slug}`),
                            },
                            {
                                name: title,
                                path: buildLocalePath(locale, `/topics/${topic.slug}/terms`),
                            },
                        ]),
                    ]),
                }}
            />
        </div>
    );
}
