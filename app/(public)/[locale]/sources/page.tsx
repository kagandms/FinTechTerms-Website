import { notFound } from 'next/navigation';
import { getLocalizedText, listSeoSources } from '@/lib/public-seo-catalog';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const pageCopy: Record<Language, { title: string; description: string; verified: string }> = {
    en: {
        title: 'Primary source library',
        description: 'Reference library for glossary terms, editorial review, and public trust signals.',
        verified: 'verified',
    },
    ru: {
        title: 'Библиотека первичных источников',
        description: 'Справочная библиотека для глоссарных терминов, редакционной проверки и публичных trust-сигналов.',
        verified: 'проверено',
    },
    tr: {
        title: 'Birincil kaynak kütüphanesi',
        description: 'Sözlük terimleri, editoryal inceleme ve kamusal güven sinyalleri için referans kütüphanesi.',
        verified: 'doğrulandı',
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
        path: buildLocalePath(rawLocale, '/sources'),
    });
}

export default async function SourcesPage({
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
    const sources = await listSeoSources();

    return (
        <div className="space-y-8">
            <section className="rounded-[2.5rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10">
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{copy.title}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{copy.description}</p>
            </section>
            <section className="grid gap-3">
                {sources.map((source) => (
                    <a
                        key={source.id}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-900"
                    >
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{source.publisher}</p>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            {copy.verified} {source.last_verified}
                        </span>
                </div>
                        <h2 className="mt-2 text-xl font-bold text-slate-950">{getLocalizedText(source.title, locale)}</h2>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{getLocalizedText(source.note, locale)}</p>
                    </a>
                ))}
            </section>
        </div>
    );
}
