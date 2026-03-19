import Link from 'next/link';
import { notFound } from 'next/navigation';
import '@/app/globals.css';
import PublicLocalePreferenceSync from '@/components/public-locale-preference-sync';
import PublicLocaleSwitcher from '@/components/public-locale-switcher';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { inter, jetbrainsMono } from '@/lib/fonts';
import { getScriptNonce } from '@/lib/script-nonce';
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
    const nonce = await getScriptNonce();

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const locale = rawLocale;
    const copy = layoutCopy[locale];

    return (
        <html lang={locale}>
            <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#f5f7fb] text-slate-950`}>
                <PublicLocalePreferenceSync locale={locale} />
                <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,59,94,0.14),_transparent_40%),linear-gradient(180deg,_#f7fafc_0%,_#eef4ff_100%)]">
                    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
                        <header className="rounded-[2rem] border border-slate-200/80 bg-white/90 px-5 py-5 shadow-sm backdrop-blur md:px-8">
                            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <Link href={buildLocalePath(locale)} className="text-2xl font-black tracking-tight text-slate-950">
                                        FinTechTerms
                                    </Link>
                                    <p className="mt-1 text-sm text-slate-500">{copy.footer}</p>
                                </div>
                                <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
                                    <Link href={buildLocalePath(locale)} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.home}</Link>
                                    <Link href={buildLocalePath(locale, '/glossary')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.glossary}</Link>
                                    <Link href={buildLocalePath(locale, '/methodology')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.methodology}</Link>
                                    <Link href={buildLocalePath(locale, '/about')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.about}</Link>
                                    <Link href={buildLocalePath(locale, '/sources')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.sources}</Link>
                                    <Link href={buildLocalePath(locale, '/editorial-policy')} className="rounded-full px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-950">{copy.editorial}</Link>
                                </nav>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{copy.languageLabel}</span>
                                <PublicLocaleSwitcher currentLocale={locale} />
                            </div>
                        </header>
                        <main className="mt-8">{children}</main>
                    </div>
                </div>
                <GoogleAnalytics nonce={nonce} />
            </body>
        </html>
    );
}
