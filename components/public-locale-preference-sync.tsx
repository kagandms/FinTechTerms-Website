'use client';

import { useEffect } from 'react';
import { persistLocalePreference } from '@/lib/client-locale-preference';
import type { Language } from '@/types';

interface PublicLocalePreferenceSyncProps {
    readonly locale: Language;
}

export default function PublicLocalePreferenceSync({
    locale,
}: PublicLocalePreferenceSyncProps) {
    useEffect(() => {
        persistLocalePreference(locale);
    }, [locale]);

    return null;
}
