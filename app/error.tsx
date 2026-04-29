'use client';

import { useEffect } from 'react';
import { resolveHomeHref } from '@/lib/navigation';

const copy = {
    title: 'Something went wrong',
    description: 'The application hit an unexpected error. Retry the page or return to the home surface.',
    retry: 'Try again',
    home: 'Home',
};

const getCurrentPathname = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.location.pathname;
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
    const homeHref = resolveHomeHref(getCurrentPathname());

    useEffect(() => {
        reportBoundaryError(error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
                    <span className="text-3xl font-black text-red-500">!</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {copy.title}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                    {copy.description}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-md"
                    >
                        {copy.retry}
                    </button>
                    <a
                        href={homeHref}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        {copy.home}
                    </a>
                </div>
            </div>
        </div>
    );
}
