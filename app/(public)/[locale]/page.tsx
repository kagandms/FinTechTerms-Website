import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listPrioritySeoTerms, listSeoTopics, getLocalizedTermDefinition, getLocalizedTermLabel, getLocalizedText } from '@/lib/public-seo-catalog';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    eyebrow: string;
    hero: string;
    subhero: string;
    topics: string;
    featuredTerms: string;
    browseAll: string;
}> = {
    en: {
        title: 'FinTechTerms English glossary',
        description: 'English fintech glossary with topic hubs, trust signals, and localized server-rendered terminology pages.',
        eyebrow: 'Public SEO surface',
        hero: 'A topic-based glossary architecture for fintech, finance, and technology terms.',
        subhero: 'Browse server-rendered term pages, academic trust signals, editorial review, and market-aware topic hubs.',
        topics: 'Topic hubs',
        featuredTerms: 'Priority terms',
        browseAll: 'Browse full glossary',
    },
    ru: {
        title: 'FinTechTerms: русский глоссарий',
        description: 'Русский финтех-глоссарий с topic hub-архитектурой, trust-сигналами и серверно-рендеримыми терминологическими страницами.',
        eyebrow: 'Публичный SEO-контур',
        hero: 'Тематическая архитектура глоссария для терминов финтеха, финансов и технологий.',
        subhero: 'Изучайте серверно-рендеримые термины, академические trust-сигналы, редакционную проверку и topic hub-страницы с рыночным контекстом.',
        topics: 'Тематические хабы',
        featuredTerms: 'Приоритетные термины',
        browseAll: 'Открыть полный глоссарий',
    },
    tr: {
        title: 'FinTechTerms Türkçe sözlük',
        description: 'Topic hub yapısı, güven sinyalleri ve server-rendered fintech terim sayfalarıyla Türkçe fintek sözlüğü.',
        eyebrow: 'Public SEO yüzeyi',
        hero: 'Fintek, finans ve teknoloji terimleri için konu tabanlı bir sözlük mimarisi.',
        subhero: 'Server-rendered terim sayfalarını, akademik güven sinyallerini, editoryal incelemeyi ve pazar bağlamlı topic hub’ları keşfedin.',
        topics: 'Topic hub’lar',
        featuredTerms: 'Öncelikli terimler',
        browseAll: 'Tam sözlüğü aç',
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
        path: buildLocalePath(rawLocale),
    });
}

export default async function LocaleHomePage({
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
    const [topics, priorityTerms] = await Promise.all([
        listSeoTopics(),
        listPrioritySeoTerms(9),
    ]);

    return (
        <div className="space-y-8">
            <section className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10">
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    {copy.eyebrow}
                </span>
                <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                    {copy.hero}
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
                    {copy.subhero}
                </p>
                <Link
                    href={buildLocalePath(locale, '/glossary')}
                    className="mt-8 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
                >
                    {copy.browseAll}
                </Link>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-950">{copy.topics}</h2>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {topics.map((topic) => (
                            <Link
                                key={topic.id}
                                href={buildLocalePath(locale, `/topics/${topic.slug}`)}
                                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-900 hover:bg-slate-100"
                            >
                                <p className="text-lg font-semibold text-slate-950">{getLocalizedText(topic.title, locale)}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{getLocalizedText(topic.description, locale)}</p>
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-950">{copy.featuredTerms}</h2>
                    <div className="mt-5 space-y-3">
                        {priorityTerms.map((term) => (
                            <Link
                                key={term.id}
                                href={buildLocalePath(locale, `/glossary/${term.slug}`)}
                                className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-900 hover:bg-slate-100"
                            >
                                <p className="text-lg font-semibold text-slate-950">{getLocalizedTermLabel(term, locale)}</p>
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                                    {getLocalizedTermDefinition(term, locale)}
                                </p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
