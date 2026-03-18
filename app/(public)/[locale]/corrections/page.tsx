import { notFound } from 'next/navigation';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    body: string;
}> = {
    en: {
        title: 'Corrections policy',
        description: 'How FinTechTerms records corrections, source updates, and factual revisions.',
        body: 'When a definition, regulatory framing, or source reference becomes outdated, FinTechTerms revises the affected page, updates the visible review timestamp, and revalidates the source set. Material corrections are routed through the editorial review layer before publication.',
    },
    ru: {
        title: 'Политика исправлений',
        description: 'Как FinTechTerms фиксирует исправления, обновления источников и фактические ревизии.',
        body: 'Когда определение, регуляторная рамка или ссылка на источник устаревает, FinTechTerms пересматривает соответствующую страницу, обновляет видимый таймштамп ревью и заново валидирует набор источников. Существенные исправления проходят через редакционный слой проверки перед публикацией.',
    },
    tr: {
        title: 'Düzeltme politikası',
        description: 'FinTechTerms’in düzeltmeleri, kaynak güncellemelerini ve olgusal revizyonları nasıl kaydettiği.',
        body: 'Bir tanım, düzenleyici çerçeve veya kaynak referansı güncelliğini yitirdiğinde FinTechTerms ilgili sayfayı revize eder, görünür inceleme zaman damgasını günceller ve kaynak setini yeniden doğrular. Önemli düzeltmeler yayın öncesinde editoryal inceleme katmanından geçer.',
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
        path: buildLocalePath(rawLocale, '/corrections'),
    });
}

export default async function CorrectionsPage({
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
        <section className="rounded-[2.5rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10">
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{copy.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{copy.description}</p>
            <p className="mt-8 max-w-3xl text-sm leading-8 text-slate-600">{copy.body}</p>
        </section>
    );
}
