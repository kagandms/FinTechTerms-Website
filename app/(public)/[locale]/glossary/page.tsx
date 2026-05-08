import { notFound } from 'next/navigation';
import { getLocalizedTermDefinition, getLocalizedTermLabel, getLocalizedText, listGlossaryLetterGroups, listSeoTopics } from '@/lib/public-seo-catalog';
import PublicSiblingLocaleLinks from '@/components/public-sibling-locale-links';
import { serializeJsonLd } from '@/lib/json-ld';
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd } from '@/lib/public-schema';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    eyebrow: string;
    hero: string;
    startHere: string;
    topicHub: string;
    topicTerms: string;
    browseByLetter: string;
}> = {
    en: {
        title: 'FinTech glossary directory',
        description: 'Server-rendered fintech glossary directory with crawlable anchors across payments, open banking, crypto infrastructure, and finance.',
        eyebrow: 'Glossary index',
        hero: 'Browse the full glossary with crawlable alphabetic sections.',
        startHere: 'Start with a topic hub',
        topicHub: 'Topic hub',
        topicTerms: 'Term index',
        browseByLetter: 'Browse by first letter',
    },
    ru: {
        title: 'Каталог финтех-глоссария',
        description: 'Серверно-рендеримый каталог финтех-глоссария со сканируемыми ссылками по платежам, открытому банкингу, криптоинфраструктуре и финансам.',
        eyebrow: 'Индекс глоссария',
        hero: 'Просматривайте полный глоссарий через сканируемые алфавитные секции.',
        startHere: 'Начните с тематического хаба',
        topicHub: 'Хаб темы',
        topicTerms: 'Индекс терминов',
        browseByLetter: 'Просмотр по первой букве',
    },
    tr: {
        title: 'Fintek sözlük dizini',
        description: 'Ödemeler, açık bankacılık, kripto altyapısı ve finans kümelerinde taranabilir bağlantılara sahip, sunucuda işlenen fintek sözlük dizini.',
        eyebrow: 'Sözlük indeksi',
        hero: 'Tam sözlüğü taranabilir alfabetik bölümler üzerinden keşfedin.',
        startHere: 'Bir konu merkezi ile başlayın',
        topicHub: 'Konu merkezi',
        topicTerms: 'Terim indeksi',
        browseByLetter: 'İlk harfe göre göz at',
    },
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;

    if (!isPublicLocale(rawLocale)) {
        return {};
    }

    const copy = pageCopy[rawLocale];

    return buildSeoMetadata({
        locale: rawLocale,
        title: copy.title,
        description: copy.description,
        path: buildLocalePath(rawLocale, '/glossary'),
    });
}

export default async function GlossaryPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const locale = rawLocale;
    const copy = pageCopy[locale];
    const [groups, topics] = await Promise.all([
        listGlossaryLetterGroups(locale),
        listSeoTopics(),
    ]);
    const terms = groups.flatMap((group) => group.terms);

    return (
        <div className="space-y-14 md:space-y-8">
            <PublicSiblingLocaleLinks currentLocale={locale} suffix="/glossary" />

            <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-6 shadow-sm md:rounded-[2.5rem] md:px-10 md:py-10">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.eyebrow}
                </span>
                <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">{copy.hero}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{copy.description}</p>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-950">{copy.startHere}</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {topics.map((topic) => (
                        <article
                            key={topic.id}
                            className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-900 hover:bg-slate-100"
                        >
                            <p className="text-base font-semibold text-slate-950">{getLocalizedText(topic.title, locale)}</p>
                            <p className="mt-2 text-base leading-7 text-slate-600">{getLocalizedText(topic.description, locale)}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <a
                                    href={buildLocalePath(locale, `/topics/${topic.slug}`)}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-950"
                                >
                                    {copy.topicHub}
                                </a>
                                <a
                                    href={buildLocalePath(locale, `/topics/${topic.slug}/terms`)}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-950"
                                >
                                    {copy.topicTerms}
                                </a>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-950">{copy.browseByLetter}</h2>
                <div className="flex flex-wrap gap-2">
                    {groups.map((group) => (
                        <a
                            key={group.key}
                            href={buildLocalePath(locale, `/glossary/letter/${group.key}`)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:border-slate-900 hover:text-slate-950"
                        >
                            {group.label}
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
                            name: copy.title,
                            description: copy.description,
                            url: buildAbsoluteUrl(buildLocalePath(locale, '/glossary')),
                            inLanguage: locale,
                            numberOfItems: terms.length,
                            publisher: buildOrganizationJsonLd(locale),
                            hasDefinedTerm: terms.slice(0, 100).map((term) => ({
                                '@type': 'DefinedTerm',
                                name: getLocalizedTermLabel(term, locale),
                                description: getLocalizedTermDefinition(term, locale),
                                url: buildAbsoluteUrl(buildLocalePath(locale, `/glossary/${term.slug}`)),
                            })),
                        },
                        buildBreadcrumbJsonLd(locale, [{ name: copy.title, path: buildLocalePath(locale, '/glossary') }]),
                    ]),
                }}
            />
        </div>
    );
}
