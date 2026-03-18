import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    missionTitle: string;
    missionBody: string;
    architectureTitle: string;
    architectureBody: string;
    peopleTitle: string;
}> = {
    en: {
        title: 'About FinTechTerms',
        description: 'Public project overview for the multilingual fintech glossary, editorial architecture, and academic trust layer.',
        missionTitle: 'Mission',
        missionBody: 'FinTechTerms is built as a multilingual glossary and learning infrastructure for fintech, finance, and technology terminology with strong public trust signals.',
        architectureTitle: 'Architecture',
        architectureBody: 'The public SEO layer is server-rendered, locale-based, and designed around crawlable glossary directories, topic hubs, and source-backed term pages.',
        peopleTitle: 'People and review',
    },
    ru: {
        title: 'О FinTechTerms',
        description: 'Публичное описание многоязычного финтех-глоссария, редакционной архитектуры и академического trust-слоя.',
        missionTitle: 'Миссия',
        missionBody: 'FinTechTerms создаётся как многоязычный глоссарий и учебная инфраструктура для терминологии финтеха, финансов и технологий с сильными публичными trust-сигналами.',
        architectureTitle: 'Архитектура',
        architectureBody: 'Публичный SEO-контур серверно-рендерим, построен по locale-модели и опирается на сканируемые каталоги, topic hub-страницы и source-backed терминологические материалы.',
        peopleTitle: 'Команда и ревью',
    },
    tr: {
        title: 'FinTechTerms hakkında',
        description: 'Çok dilli fintek sözlüğü, editoryal mimari ve akademik güven katmanı için kamusal proje özeti.',
        missionTitle: 'Misyon',
        missionBody: 'FinTechTerms; fintek, finans ve teknoloji terminolojisi için güçlü kamusal güven sinyallerine sahip çok dilli bir sözlük ve öğrenme altyapısı olarak geliştirilir.',
        architectureTitle: 'Mimari',
        architectureBody: 'Kamusal SEO katmanı server-rendered, locale tabanlıdır ve taranabilir sözlük dizinleri, topic hub’lar ve kaynak destekli terim sayfaları üzerine kuruludur.',
        peopleTitle: 'Ekip ve inceleme',
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
        path: buildLocalePath(rawLocale, '/about'),
    });
}

export default async function AboutPage({
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

    return (
        <div className="space-y-6">
            <section className="rounded-[2.5rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10">
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{copy.title}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{copy.description}</p>
            </section>
            <section className="grid gap-4 lg:grid-cols-3">
                <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-950">{copy.missionTitle}</h2>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{copy.missionBody}</p>
                </article>
                <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-950">{copy.architectureTitle}</h2>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{copy.architectureBody}</p>
                </article>
                <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-950">{copy.peopleTitle}</h2>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                        <Link href={buildLocalePath(locale, '/authors/kagan-samet-durmus')} className="block font-semibold text-sky-700 hover:text-slate-950">
                            Kağan Samet Durmuş
                        </Link>
                        <Link href={buildLocalePath(locale, '/authors/fintechterms-editorial-review')} className="block font-semibold text-sky-700 hover:text-slate-950">
                            FinTechTerms Editorial Review
                        </Link>
                    </div>
                </article>
            </section>
        </div>
    );
}
