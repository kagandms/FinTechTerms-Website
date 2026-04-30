import { PUBLIC_LOCALES, buildLocalePath } from '@/lib/seo-routing';
import type { ReactElement } from 'react';
import type { Language } from '@/types';

interface PublicSiblingLocaleLinksProps {
    readonly currentLocale: Language;
    readonly suffix?: string;
}

const labelByLocale: Record<Language, string> = {
    en: 'Available languages',
    ru: 'Языковые версии',
    tr: 'Dil seçenekleri',
};

export default function PublicSiblingLocaleLinks({
    currentLocale,
    suffix = '',
}: PublicSiblingLocaleLinksProps): ReactElement {
    return (
        <nav
            aria-label={labelByLocale[currentLocale]}
            data-public-sibling-locale-links
            className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
        >
            <span className="text-slate-400">{labelByLocale[currentLocale]}</span>
            {PUBLIC_LOCALES.map((candidateLocale) => {
                const isActive = candidateLocale === currentLocale;

                return (
                    <a
                        key={candidateLocale}
                        href={buildLocalePath(candidateLocale, suffix)}
                        hrefLang={candidateLocale}
                        rel="alternate"
                        data-public-sibling-locale-link
                        data-locale={candidateLocale}
                        aria-current={isActive ? 'page' : undefined}
                        className={`rounded-full border px-3 py-1.5 transition-colors ${
                            isActive
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-950'
                        }`}
                    >
                        {candidateLocale}
                    </a>
                );
            })}
        </nav>
    );
}
