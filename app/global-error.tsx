'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_LANGUAGE } from '@/lib/language';
import { logger } from '@/lib/logger';
import { getTranslationString } from '@/lib/i18n';
import { resolveHomeHref } from '@/lib/navigation';
import { getCurrentLanguage } from '@/utils/storage';
import type { Language } from '@/types';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [language] = useState<Language>(() => getCurrentLanguage() ?? DEFAULT_LANGUAGE);

    useEffect(() => {
        logger.error('CRITICAL_GLOBAL_ERROR_BOUNDARY_CAUGHT', {
            route: 'app/global-error',
            error,
        });
    }, [error]);

    const title = getTranslationString(language, 'errors.criticalTitle') ?? 'A critical error occurred';
    const description = getTranslationString(language, 'errors.criticalDescription')
        ?? 'The application encountered an unexpected failure. Try again or return to the home page.';
    const retryLabel = getTranslationString(language, 'errors.retry') ?? 'Try Again';
    const homeLabel = getTranslationString(language, 'errors.home') ?? 'Home';

    return (
        <html lang={language}>
            <body className="min-h-screen bg-slate-950 text-slate-50">
                <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
                        FinTechTerms
                    </p>
                    <h1 className="text-3xl font-bold">{title}</h1>
                    <p className="mt-3 text-sm text-slate-300">
                        {description}
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={reset}
                            className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-sky-400"
                        >
                            {retryLabel}
                        </button>
                        <a
                            href={resolveHomeHref(null)}
                            className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-900"
                        >
                            {homeLabel}
                        </a>
                    </div>
                </main>
            </body>
        </html>
    );
}
