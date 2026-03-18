import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listGlossaryTerms, getLocalizedTermDefinition, getLocalizedTermLabel, getLocalizedText, listSeoTopics } from '@/lib/public-seo-catalog';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language, Term } from '@/types';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    eyebrow: string;
    hero: string;
    startHere: string;
}> = {
    en: {
        title: 'FinTech glossary directory',
        description: 'Server-rendered fintech glossary directory with crawlable anchors across payments, open banking, crypto infrastructure, and finance.',
        eyebrow: 'Glossary index',
        hero: 'Browse the full glossary with crawlable alphabetic sections.',
        startHere: 'Start with a topic hub',
    },
    ru: {
        title: 'Каталог финтех-глоссария',
        description: 'Серверно-рендеримый каталог финтех-глоссария со сканируемыми анкорами по платежам, open banking, криптоинфраструктуре и финансам.',
        eyebrow: 'Индекс глоссария',
        hero: 'Просматривайте полный глоссарий через сканируемые алфавитные секции.',
        startHere: 'Начните с тематического хаба',
    },
    tr: {
        title: 'Fintek sözlük dizini',
        description: 'Ödemeler, açık bankacılık, kripto altyapısı ve finans kümelerinde taranabilir anchor’lara sahip server-rendered fintek sözlük dizini.',
        eyebrow: 'Sözlük indeksi',
        hero: 'Tam sözlüğü taranabilir alfabetik bölümler üzerinden keşfedin.',
        startHere: 'Bir topic hub ile başlayın',
    },
};

const groupTermsByLetter = (terms: readonly Term[], locale: Language): Array<{ letter: string; terms: readonly Term[] }> => {
    const groupedTerms = new Map<string, Term[]>();

    for (const term of terms) {
        const label = getLocalizedTermLabel(term, locale).trim();
        const letter = (label[0] ?? '#').toUpperCase();
        const bucket = groupedTerms.get(letter) ?? [];
        bucket.push(term);
        groupedTerms.set(letter, bucket);
    }

    return Array.from(groupedTerms.entries())
        .sort(([left], [right]) => left.localeCompare(right, locale))
        .map(([letter, bucket]) => ({ letter, terms: bucket }));
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
    const [terms, topics] = await Promise.all([
        listGlossaryTerms(locale),
        listSeoTopics(),
    ]);
    const groups = groupTermsByLetter(terms, locale);

    return (
        <div className="space-y-8">
            <section className="rounded-[2.5rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.eyebrow}
                </span>
                <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{copy.hero}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{copy.description}</p>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-950">{copy.startHere}</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {topics.map((topic) => (
                        <Link
                            key={topic.id}
                            href={buildLocalePath(locale, `/topics/${topic.slug}`)}
                            className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-900 hover:bg-slate-100"
                        >
                            <p className="text-base font-semibold text-slate-950">{getLocalizedText(topic.title, locale)}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{getLocalizedText(topic.description, locale)}</p>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap gap-2">
                    {groups.map((group) => (
                        <a
                            key={group.letter}
                            href={`#group-${group.letter}`}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:border-slate-900 hover:text-slate-950"
                        >
                            {group.letter}
                        </a>
                    ))}
                </div>
            </section>

            <section className="space-y-6">
                {groups.map((group) => (
                    <div
                        id={`group-${group.letter}`}
                        key={group.letter}
                        className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                    >
                        <h2 className="text-2xl font-black tracking-tight text-slate-950">{group.letter}</h2>
                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {group.terms.map((term) => (
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
                    </div>
                ))}
            </section>
        </div>
    );
}
