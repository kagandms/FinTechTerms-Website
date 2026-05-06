import { Mail } from 'lucide-react';
import { notFound } from 'next/navigation';
import PublicSiblingLocaleLinks from '@/components/public-sibling-locale-links';
import { serializeJsonLd } from '@/lib/json-ld';
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd } from '@/lib/public-schema';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const contactEmail = 'fintechterms@mail.ru';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    emailLabel: string;
    correctionLabel: string;
    correctionBody: string;
}> = {
    en: {
        title: 'Contact FinTechTerms',
        description: 'Contact channel for editorial corrections, source updates, privacy questions, and public glossary feedback.',
        emailLabel: 'Email',
        correctionLabel: 'Corrections and source updates',
        correctionBody: 'Send the affected URL, the exact claim that needs review, and the source that supports the correction.',
    },
    ru: {
        title: 'Связаться с FinTechTerms',
        description: 'Канал связи для редакционных исправлений, обновлений источников, вопросов конфиденциальности и обратной связи по глоссарию.',
        emailLabel: 'Email',
        correctionLabel: 'Исправления и обновления источников',
        correctionBody: 'Отправьте URL страницы, точное утверждение для проверки и источник, который подтверждает исправление.',
    },
    tr: {
        title: 'FinTechTerms ile iletişim',
        description: 'Editoryal düzeltmeler, kaynak güncellemeleri, gizlilik soruları ve public sözlük geri bildirimi için iletişim kanalı.',
        emailLabel: 'E-posta',
        correctionLabel: 'Düzeltmeler ve kaynak güncellemeleri',
        correctionBody: 'Etkilenen URL’yi, incelenmesi gereken net iddiayı ve düzeltmeyi destekleyen kaynağı gönderin.',
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
        path: buildLocalePath(rawLocale, '/contact'),
    });
}

export default async function ContactPage({
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
    const path = buildLocalePath(locale, '/contact');

    return (
        <div className="space-y-8">
            <PublicSiblingLocaleLinks currentLocale={locale} suffix="/contact" />
            <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-6 shadow-sm md:rounded-[2.5rem] md:px-10 md:py-10">
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{copy.title}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{copy.description}</p>
            </section>
            <section className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
                <a
                    href={`mailto:${contactEmail}`}
                    className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-sky-400"
                >
                    <Mail className="h-6 w-6 text-sky-700" />
                    <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.emailLabel}</p>
                    <p className="mt-2 text-lg font-bold text-slate-950">{contactEmail}</p>
                </a>
                <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-950">{copy.correctionLabel}</h2>
                    <p className="mt-4 text-base leading-8 text-slate-600">{copy.correctionBody}</p>
                </article>
            </section>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: serializeJsonLd([
                        {
                            '@context': 'https://schema.org',
                            '@type': 'ContactPage',
                            name: copy.title,
                            description: copy.description,
                            url: buildAbsoluteUrl(path),
                            inLanguage: locale,
                            publisher: buildOrganizationJsonLd(locale),
                        },
                        buildBreadcrumbJsonLd(locale, [{ name: copy.title, path }]),
                    ]),
                }}
            />
        </div>
    );
}
