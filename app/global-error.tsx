'use client';

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="ru">
            <body className="min-h-screen bg-slate-950 text-slate-50">
                <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
                        FinTechTerms
                    </p>
                    <h1 className="text-3xl font-bold">Произошла критическая ошибка</h1>
                    <p className="mt-3 text-sm text-slate-300">
                        Приложение столкнулось с неожиданным сбоем. Попробуйте повторить действие или вернуться на главную страницу.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={reset}
                            className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-sky-400"
                        >
                            Повторить
                        </button>
                        <Link
                            href="/"
                            className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-900"
                        >
                            На главную
                        </Link>
                    </div>
                </main>
            </body>
        </html>
    );
}
