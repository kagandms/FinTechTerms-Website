import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';
import { ArrowLeft, Blocks, Network, ShieldCheck } from 'lucide-react';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    backLabel: string;
    eyebrow: string;
    focusLabel: string;
    focusValue: string;
    standardLabel: string;
    standardValue: string;
    missionLabel: string;
    architectureLabel: string;
    peopleLabel: string;
    missionTitle: string;
    missionBody: string;
    architectureTitle: string;
    architectureBody: string;
    peopleTitle: string;
}> = {
    en: {
        title: 'About FinTechTerms',
        description: 'Public project overview for the multilingual fintech glossary, editorial architecture, and academic trust layer.',
        backLabel: 'FinTechTerms',
        eyebrow: 'Public project profile',
        focusLabel: 'Focus',
        focusValue: 'Multilingual fintech glossary',
        standardLabel: 'Standard',
        standardValue: 'Public trust and review signals',
        missionLabel: 'Core brief',
        architectureLabel: 'Delivery model',
        peopleLabel: 'Review layer',
        missionTitle: 'Mission',
        missionBody: 'FinTechTerms is built as a multilingual glossary and learning infrastructure for fintech, finance, and technology terminology with strong public trust signals.',
        architectureTitle: 'Architecture',
        architectureBody: 'The public SEO layer is server-rendered, locale-based, and designed around crawlable glossary directories, topic hubs, and source-backed term pages.',
        peopleTitle: 'People and review',
    },
    ru: {
        title: 'О FinTechTerms',
        description: 'Публичное описание многоязычного финтех-глоссария, редакционной архитектуры и академического trust-слоя.',
        backLabel: 'FinTechTerms',
        eyebrow: 'Публичный профиль проекта',
        focusLabel: 'Фокус',
        focusValue: 'Многоязычный финтех-глоссарий',
        standardLabel: 'Стандарт',
        standardValue: 'Публичные сигналы доверия и ревью',
        missionLabel: 'Кратко о проекте',
        architectureLabel: 'Модель доставки',
        peopleLabel: 'Слой ревью',
        missionTitle: 'Миссия',
        missionBody: 'FinTechTerms создаётся как многоязычный глоссарий и учебная инфраструктура для терминологии финтеха, финансов и технологий с сильными публичными trust-сигналами.',
        architectureTitle: 'Архитектура',
        architectureBody: 'Публичный SEO-контур серверно-рендерим, построен по locale-модели и опирается на сканируемые каталоги, topic hub-страницы и source-backed терминологические материалы.',
        peopleTitle: 'Команда и ревью',
    },
    tr: {
        title: 'FinTechTerms hakkında',
        description: 'Çok dilli fintek sözlüğü, editoryal mimari ve akademik güven katmanı için kamusal proje özeti.',
        backLabel: 'FinTechTerms',
        eyebrow: 'Kamusal proje profili',
        focusLabel: 'Odak',
        focusValue: 'Cok dilli fintek sozlugu',
        standardLabel: 'Standart',
        standardValue: 'Kamusal guven ve inceleme sinyalleri',
        missionLabel: 'Temel cerceve',
        architectureLabel: 'Teslim modeli',
        peopleLabel: 'Inceleme katmani',
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
        <div className="space-y-8">
            <Link
                href={buildLocalePath(locale)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950"
            >
                <ArrowLeft className="h-4 w-4" />
                {copy.backLabel}
            </Link>

            <section className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(235,244,255,0.95)_55%,_rgba(224,242,254,0.85)_100%)] px-6 py-10 shadow-sm md:px-10">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-start">
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

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <article className="rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-slate-950 p-3 text-white">
                                    <Blocks className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        {copy.focusLabel}
                                    </p>
                                    <p className="text-sm font-semibold text-slate-950">
                                        {copy.focusValue}
                                    </p>
                                </div>
                            </div>
                        </article>
                        <article className="rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-sky-600 p-3 text-white">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        {copy.standardLabel}
                                    </p>
                                    <p className="text-sm font-semibold text-slate-950">
                                        {copy.standardValue}
                                    </p>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
                <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-950 p-3 text-white">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {copy.missionLabel}
                            </p>
                            <h2 className="text-2xl font-bold text-slate-950">{copy.missionTitle}</h2>
                        </div>
                    </div>
                    <p className="mt-5 text-sm leading-7 text-slate-600">{copy.missionBody}</p>
                </article>
                <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-sky-600 p-3 text-white">
                            <Network className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {copy.architectureLabel}
                            </p>
                            <h2 className="text-2xl font-bold text-slate-950">{copy.architectureTitle}</h2>
                        </div>
                    </div>
                    <p className="mt-5 text-sm leading-7 text-slate-600">{copy.architectureBody}</p>
                </article>

                <article className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {copy.peopleLabel}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">{copy.peopleTitle}</h2>
                    <div className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
                        <Link href={buildLocalePath(locale, '/authors/kagan-samet-durmus')} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-sky-300 transition-colors hover:border-sky-300/50 hover:text-white">
                            Kağan Samet Durmuş
                        </Link>
                        <Link href={buildLocalePath(locale, '/authors/fintechterms-editorial-review')} className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-sky-300 transition-colors hover:border-sky-300/50 hover:text-white">
                            FinTechTerms Editorial Review
                        </Link>
                    </div>
                </article>
            </section>
        </div>
    );
}
