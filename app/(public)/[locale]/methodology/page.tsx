import { notFound } from 'next/navigation';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';
import { ArrowLeft, Brain, Layers3, Sparkles } from 'lucide-react';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    backLabel: string;
    eyebrow: string;
    structureLabel: string;
    structureValue: string;
    outcomeLabel: string;
    outcomeValue: string;
    layerLabel: string;
    sections: Array<{ title: string; body: string }>;
}> = {
    en: {
        title: 'Methodology',
        description: 'How FinTechTerms writes, reviews, and structures multilingual fintech glossary content.',
        backLabel: 'FinTechTerms',
        eyebrow: 'Editorial system',
        structureLabel: 'Structure',
        structureValue: '3 methodology layers',
        outcomeLabel: 'Outcome',
        outcomeValue: 'Searchable, reviewable, source-backed content',
        layerLabel: 'Layer',
        sections: [
            {
                title: 'Term writing model',
                body: 'Each priority term is written as a layered unit: concise definition, extended explanation, why-it-matters framing, operational logic, risk notes, and regional context.',
            },
            {
                title: 'Review model',
                body: 'Entries are assigned to an author and a review layer. Publication requires visible update dates, source references, and clear educational disclaimers for YMYL-sensitive material.',
            },
            {
                title: 'Discovery model',
                body: 'Glossary pages are linked through topic hubs, related-term graphs, and locale-specific server-rendered navigation rather than client-only search discovery.',
            },
        ],
    },
    ru: {
        title: 'Методология',
        description: 'Как FinTechTerms пишет, проверяет и структурирует многоязычный финтех-глоссарий.',
        backLabel: 'FinTechTerms',
        eyebrow: 'Редакционная система',
        structureLabel: 'Структура',
        structureValue: '3 слоя методологии',
        outcomeLabel: 'Результат',
        outcomeValue: 'Поисковый, проверяемый и source-backed контент',
        layerLabel: 'Слой',
        sections: [
            {
                title: 'Модель написания термина',
                body: 'Каждый приоритетный термин строится как многослойная единица: краткое определение, расширенное объяснение, блок «почему это важно», операционная логика, риски и региональный контекст.',
            },
            {
                title: 'Модель ревью',
                body: 'Материал закрепляется за автором и слоем проверки. Публикация требует видимой даты обновления, ссылок на источники и ясных образовательных дисклеймеров для YMYL-чувствительных тем.',
            },
            {
                title: 'Модель discoverability',
                body: 'Глоссарий связывается через topic hub-страницы, граф связанных терминов и locale-specific server-rendered навигацию, а не через client-only поиск.',
            },
        ],
    },
    tr: {
        title: 'Metodoloji',
        description: 'FinTechTerms’in çok dilli fintek sözlük içeriğini nasıl yazdığı, incelediği ve yapılandırdığı.',
        backLabel: 'FinTechTerms',
        eyebrow: 'Editoryal sistem',
        structureLabel: 'Yapi',
        structureValue: '3 metodoloji katmani',
        outcomeLabel: 'Cikti',
        outcomeValue: 'Aranabilir, incelenebilir ve kaynak destekli icerik',
        layerLabel: 'Katman',
        sections: [
            {
                title: 'Terim yazım modeli',
                body: 'Her öncelikli terim; kısa tanım, geniş açıklama, neden önemli çerçevesi, operasyonel mantık, risk notları ve bölgesel bağlamdan oluşan katmanlı bir yapı olarak yazılır.',
            },
            {
                title: 'İnceleme modeli',
                body: 'Maddeler bir yazar ve bir inceleme katmanına atanır. Yayın, görünür güncelleme tarihi, kaynak referansları ve YMYL hassasiyetine uygun eğitsel uyarılar gerektirir.',
            },
            {
                title: 'Keşif modeli',
                body: 'Sözlük sayfaları; topic hub’lar, ilgili terim grafikleri ve locale-specific server-rendered gezinme üzerinden bağlanır; keşif client-only aramaya bırakılmaz.',
            },
        ],
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
        path: buildLocalePath(rawLocale, '/methodology'),
    });
}

export default async function MethodologyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const copy = pageCopy[rawLocale];

    return (
        <div className="space-y-8">
            <a
                href={buildLocalePath(rawLocale)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950"
            >
                <ArrowLeft className="h-4 w-4" />
                {copy.backLabel}
            </a>

            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(239,246,255,0.96)_54%,_rgba(224,231,255,0.88)_100%)] px-5 py-6 shadow-sm md:rounded-[2.5rem] md:px-10 md:py-10">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-start">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                            {copy.eyebrow}
                        </p>
                        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                            {copy.title}
                        </h1>
                        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
                            {copy.description}
                        </p>
                    </div>

                    <div className="grid gap-3">
                        <article className="rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-slate-950 p-3 text-white">
                                    <Layers3 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        {copy.structureLabel}
                                    </p>
                                    <p className="text-sm font-semibold text-slate-950">
                                        {copy.structureValue}
                                    </p>
                                </div>
                            </div>
                        </article>
                        <article className="rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-sky-600 p-3 text-white">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        {copy.outcomeLabel}
                                    </p>
                                    <p className="text-sm font-semibold text-slate-950">
                                        {copy.outcomeValue}
                                    </p>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            <section className="grid gap-4">
                {copy.sections.map((section, index) => (
                    <article key={section.title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="max-w-3xl">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    {copy.layerLabel} {index + 1}
                                </p>
                                <h2 className="mt-2 text-2xl font-bold text-slate-950">{section.title}</h2>
                                <p className="mt-4 text-sm leading-7 text-slate-600">{section.body}</p>
                            </div>
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                                <Brain className="h-6 w-6" />
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}
