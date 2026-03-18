import { notFound } from 'next/navigation';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    sections: Array<{ title: string; body: string }>;
}> = {
    en: {
        title: 'Methodology',
        description: 'How FinTechTerms writes, reviews, and structures multilingual fintech glossary content.',
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
        <div className="space-y-6">
            <section className="rounded-[2.5rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10">
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{copy.title}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{copy.description}</p>
            </section>
            <section className="grid gap-4">
                {copy.sections.map((section) => (
                    <article key={section.title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-2xl font-bold text-slate-950">{section.title}</h2>
                        <p className="mt-4 text-sm leading-7 text-slate-600">{section.body}</p>
                    </article>
                ))}
            </section>
        </div>
    );
}
