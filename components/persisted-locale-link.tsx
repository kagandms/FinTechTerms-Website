'use client';

import Link from 'next/link';
import { persistLocalePreference } from '@/lib/client-locale-preference';
import type { ReactNode } from 'react';
import type { Language } from '@/types';

interface PersistedLocaleLinkProps {
    readonly locale: Language;
    readonly href: string;
    readonly className?: string;
    readonly ariaCurrent?: 'page';
    readonly children: ReactNode;
}

export default function PersistedLocaleLink({
    locale,
    href,
    className,
    ariaCurrent,
    children,
}: PersistedLocaleLinkProps) {
    return (
        <Link
            href={href}
            className={className}
            aria-current={ariaCurrent}
            onClick={() => persistLocalePreference(locale)}
        >
            {children}
        </Link>
    );
}
