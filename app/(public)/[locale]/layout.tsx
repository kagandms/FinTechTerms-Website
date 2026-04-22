import { notFound } from 'next/navigation';
import '@/app/globals.css';
import { PUBLIC_LOCALES, buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const layoutCopy: Record<Language, {
    home: string;
    glossary: string;
    methodology: string;
    about: string;
    sources: string;
    editorial: string;
    languageLabel: string;
    footer: string;
}> = {
    en: {
        home: 'Overview',
        glossary: 'Glossary',
        methodology: 'Methodology',
        about: 'About',
        sources: 'Sources',
        editorial: 'Editorial policy',
        languageLabel: 'Language',
        footer: 'Multilingual fintech glossary for academic and production-grade learning.',
    },
    ru: {
        home: 'Обзор',
        glossary: 'Глоссарий',
        methodology: 'Методология',
        about: 'О проекте',
        sources: 'Источники',
        editorial: 'Редакционная политика',
        languageLabel: 'Язык',
        footer: 'Многоязычный финтех-глоссарий для академического и прикладного обучения.',
    },
    tr: {
        home: 'Genel bakış',
        glossary: 'Sözlük',
        methodology: 'Metodoloji',
        about: 'Proje',
        sources: 'Kaynaklar',
        editorial: 'Editoryal politika',
        languageLabel: 'Dil',
        footer: 'Akademik ve üretim kalitesinde öğrenim için çok dilli fintek sözlüğü.',
    },
};

export const dynamicParams = false;

export function generateStaticParams(): Array<{ locale: Language }> {
    return PUBLIC_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const locale = rawLocale;
    const copy = layoutCopy[locale];

    return (
        <html lang={locale}>
            <body className="font-sans antialiased bg-[#f5f7fb] text-slate-950">
                <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,59,94,0.14),_transparent_40%),linear-gradient(180deg,_#f7fafc_0%,_#eef4ff_100%)]">
                    <div className="mx-auto max-w-6xl px-4 pb-12 pt-3 sm:px-6 sm:pt-5 lg:px-8">
                        <header className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm md:rounded-[2rem] md:px-8 md:py-5">
                            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <a href={buildLocalePath(locale)} className="text-2xl font-black tracking-tight text-slate-950">
                                        FinTechTerms
                                    </a>
                                    <p className="mt-1 hidden text-sm text-slate-500 sm:block">{copy.footer}</p>
                                </div>
                                <nav className="hidden flex-wrap items-center gap-3 text-sm font-medium text-slate-600 md:flex">
                                    <a href={buildLocalePath(locale)} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.home}</a>
                                    <a href={buildLocalePath(locale, '/glossary')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.glossary}</a>
                                    <a href={buildLocalePath(locale, '/methodology')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.methodology}</a>
                                    <a href={buildLocalePath(locale, '/about')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.about}</a>
                                    <a href={buildLocalePath(locale, '/sources')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.sources}</a>
                                    <a href={buildLocalePath(locale, '/editorial-policy')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.editorial}</a>
                                </nav>
                            </div>
                            <div className="mt-3 hidden flex-wrap items-center gap-2 border-t border-slate-200 pt-3 sm:flex md:mt-4 md:pt-4">
                                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{copy.languageLabel}</span>
                                {PUBLIC_LOCALES.map((candidateLocale) => {
                                    const isActive = candidateLocale === locale;

                                    return (
                                        <a
                                            key={candidateLocale}
                                            href={buildLocalePath(candidateLocale)}
                                            aria-current={isActive ? 'page' : undefined}
                                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                                                isActive
                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-950'
                                            }`}
                                        >
                                            {candidateLocale}
                                        </a>
                                    );
                                })}
                            </div>
                        </header>
                        <main className="mt-4 md:mt-8">{children}</main>
                    </div>
                </div>
            </body>
        </html>
    );
}
