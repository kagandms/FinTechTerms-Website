import PersistedLocaleLink from '@/components/persisted-locale-link';
import { seoTopics } from '@/data/seo/topics';
import { buildLocalePath } from '@/lib/seo-routing';
import type { Language } from '@/types';

const localeCards: ReadonlyArray<{
    locale: Language;
    label: string;
    description: string;
}> = [
    {
        locale: 'ru',
        label: 'Русский',
        description: 'Академический и конкурсный контур для финтех-терминологии, рынков и доверительных сигналов.',
    },
    {
        locale: 'en',
        label: 'English',
        description: 'International SEO surface for fintech, payments, market infrastructure, and product terminology.',
    },
    {
        locale: 'tr',
        label: 'Türkçe',
        description: 'Büyüme, fintech ürün dili ve yerel anlatım için optimize edilmiş Türkçe glossary yüzeyi.',
    },
];

export default function RootPage() {
    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,_#f6f8fc_0%,_#eef4ff_100%)]">
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
                    <div className="grid gap-10 px-6 py-10 md:grid-cols-[1.2fr,0.8fr] md:px-10 md:py-12">
                        <div>
                            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                                x-default entrypoint
                            </span>
                            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                                FinTechTerms builds a multilingual public glossary layer for fintech authority, trust, and discoverability.
                            </h1>
                            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
                                Choose your public locale surface. Each route tree is built for server-rendered indexation, topic-based discovery, and high-trust terminology coverage across fintech, finance, and technology.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                {localeCards.map((card) => (
                                    <PersistedLocaleLink
                                        key={card.locale}
                                        locale={card.locale}
                                        href={buildLocalePath(card.locale)}
                                        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
                                    >
                                        Open {card.label}
                                    </PersistedLocaleLink>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Priority topic clusters
                            </p>
                            <div className="mt-5 space-y-3">
                                {seoTopics.slice(0, 5).map((topic) => (
                                    <div key={topic.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="text-sm font-semibold text-slate-950">{topic.title.en}</p>
                                        <p className="mt-1 text-sm text-slate-500">{topic.description.en}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-8 grid gap-4 md:grid-cols-3">
                    {localeCards.map((card) => (
                        <article key={card.locale} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{card.locale}</p>
                            <h2 className="mt-3 text-2xl font-bold text-slate-950">{card.label}</h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
                            <PersistedLocaleLink
                                locale={card.locale}
                                href={buildLocalePath(card.locale)}
                                className="mt-5 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-950"
                            >
                                Enter locale
                            </PersistedLocaleLink>
                        </article>
                    ))}
                </section>
            </div>
        </div>
    );
}
