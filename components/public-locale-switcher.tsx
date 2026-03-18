'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import PersistedLocaleLink from '@/components/persisted-locale-link';
import { PUBLIC_LOCALES, buildSiblingLocalePath } from '@/lib/seo-routing';
import type { Language } from '@/types';

interface PublicLocaleSwitcherProps {
    readonly currentLocale: Language;
}

const buildLocalizedHref = (
    pathname: string | null | undefined,
    targetLocale: Language,
    searchQuery: string,
    hashFragment: string
): string => {
    const localizedPath = buildSiblingLocalePath(pathname, targetLocale);
    const querySuffix = searchQuery ? `?${searchQuery}` : '';

    return `${localizedPath}${querySuffix}${hashFragment}`;
};

export default function PublicLocaleSwitcher({
    currentLocale,
}: PublicLocaleSwitcherProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [hashFragment, setHashFragment] = useState('');
    const searchQuery = searchParams.toString();

    useEffect(() => {
        const syncHashFragment = () => {
            setHashFragment(window.location.hash || '');
        };

        syncHashFragment();
        window.addEventListener('hashchange', syncHashFragment);

        return () => {
            window.removeEventListener('hashchange', syncHashFragment);
        };
    }, [pathname, searchQuery]);

    return (
        <>
            {PUBLIC_LOCALES.map((candidateLocale) => {
                const isActive = candidateLocale === currentLocale;

                return (
                    <PersistedLocaleLink
                        key={candidateLocale}
                        locale={candidateLocale}
                        href={buildLocalizedHref(pathname, candidateLocale, searchQuery, hashFragment)}
                        ariaCurrent={isActive ? 'page' : undefined}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                            isActive
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-950'
                        }`}
                    >
                        {candidateLocale}
                    </PersistedLocaleLink>
                );
            })}
        </>
    );
}
