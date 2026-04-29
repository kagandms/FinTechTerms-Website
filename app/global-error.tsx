'use client';

import { useEffect } from 'react';
import { resolveHomeHref } from '@/lib/navigation';

const copy = {
    title: 'A critical error occurred',
    description: 'The application encountered an unexpected failure. Try again or return to the home page.',
    retry: 'Try again',
    home: 'Home',
};

const reportBoundaryError = (error: Error): void => {
    if (typeof globalThis.reportError !== 'function') {
        return;
    }

    globalThis.reportError(error);
};

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        reportBoundaryError(error);
    }, [error]);

    return (
        <html lang="en">
            <body className="min-h-screen bg-slate-950 text-slate-50">
                <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
                        FinTechTerms
                    </p>
                    <h1 className="text-3xl font-bold">{copy.title}</h1>
                    <p className="mt-3 text-sm text-slate-300">
                        {copy.description}
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={reset}
                            className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-sky-400"
                        >
                            {copy.retry}
                        </button>
                        <a
                            href={resolveHomeHref(null)}
                            className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-900"
                        >
                            {copy.home}
                        </a>
                    </div>
                </main>
            </body>
        </html>
    );
}
