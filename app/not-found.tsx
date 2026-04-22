import Link from 'next/link';

export default function NotFound() {
    const copy = {
        badge: 'Academic catalog',
        title: 'Page not found',
        description: 'The requested section does not exist in the current catalog structure or has been moved to another research surface.',
        home: 'Back to Home',
        search: 'Go to Search',
    };

    return (
        <div className="flex min-h-[72vh] items-center justify-center px-4 py-10">
            <div className="app-surface-muted w-full max-w-2xl rounded-[2rem] bg-gradient-to-br from-white via-slate-50 to-sky-50 p-8 text-center dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
                    {copy.badge}
                </span>

                <div className="mt-5 text-8xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-sky-700 to-slate-500 dark:from-white dark:via-sky-300 dark:to-slate-400">
                    404
                </div>

                <h1 className="mt-4 text-3xl font-semibold text-slate-950 dark:text-slate-50">
                    {copy.title}
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {copy.description}
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                    <Link
                        href="/ru"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-sky-200"
                    >
                        {copy.home}
                    </Link>
                    <Link
                        href="/search"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        {copy.search}
                    </Link>
                </div>
            </div>
        </div>
    );
}
