import { buildLocalePath } from '@/lib/seo-routing';

const localeEntries = [
    {
        href: buildLocalePath('ru'),
        label: 'Russian glossary',
        description: 'Fintech, finance, and technology terms localized for Russian search intent.',
    },
    {
        href: buildLocalePath('en'),
        label: 'English glossary',
        description: 'Public term hubs for fintech infrastructure, payments, markets, and compliance.',
    },
    {
        href: buildLocalePath('tr'),
        label: 'Turkish glossary',
        description: 'Fintek, finans ve teknoloji terimleri için taranabilir kamusal sözlük yüzeyi.',
    },
] as const;

const publicEntryLinks = [
    { href: buildLocalePath('ru', '/glossary'), label: 'RU glossary index' },
    { href: buildLocalePath('en', '/glossary'), label: 'EN glossary index' },
    { href: buildLocalePath('tr', '/glossary'), label: 'TR glossary index' },
    { href: buildLocalePath('en', '/topics/cards-payments'), label: 'Cards and payments hub' },
    { href: buildLocalePath('en', '/topics/open-banking'), label: 'Open banking hub' },
    { href: buildLocalePath('en', '/topics/regtech-compliance'), label: 'RegTech and compliance hub' },
    { href: buildLocalePath('en', '/sources'), label: 'Source library' },
    { href: buildLocalePath('en', '/editorial-policy'), label: 'Editorial policy' },
] as const;

export const dynamic = 'force-static';

export default function HomePage() {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-12 sm:px-8 lg:px-10">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">
                    FinTechTerms
                </p>
                <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">
                    Multilingual fintech glossary for search, study, and product teams
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                    Choose a localized public surface or enter through the crawlable glossary
                    architecture covering payments, open banking, crypto infrastructure,
                    compliance, market structure, and financial analysis.
                </p>

                <div className="mt-10 grid gap-4 md:grid-cols-3">
                    {localeEntries.map((entry) => (
                        <a
                            key={entry.href}
                            href={entry.href}
                            className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-sky-300/70 hover:bg-white/10"
                        >
                            <span className="text-lg font-bold text-white">{entry.label}</span>
                            <span className="mt-3 block text-sm leading-6 text-slate-300">
                                {entry.description}
                            </span>
                        </a>
                    ))}
                </div>

                <nav aria-label="Public SEO entry points" className="mt-10 flex flex-wrap gap-3">
                    {publicEntryLinks.map((entry) => (
                        <a
                            key={entry.href}
                            href={entry.href}
                            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-sky-300 hover:text-white"
                        >
                            {entry.label}
                        </a>
                    ))}
                </nav>
            </section>
        </main>
    );
}
