import React from 'react';

interface ValueHintListProps {
    title: string;
    items: readonly string[];
    tone?: 'subtle' | 'strong';
}

const wrapperClassNames: Record<NonNullable<ValueHintListProps['tone']>, string> = {
    subtle: 'rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50 p-6 shadow-md dark:border-slate-700/60 dark:from-slate-800/80 dark:to-slate-900/90 backdrop-blur-md',
    strong: 'relative overflow-hidden rounded-3xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-6 shadow-md dark:border-primary-800/50 dark:from-slate-800 dark:to-slate-900',
};

export default function ValueHintList({
    title,
    items,
    tone = 'subtle',
}: ValueHintListProps) {
    return (
        <section className={wrapperClassNames[tone]}>
            <div className="flex items-center gap-2 mb-4">
                <span className="flex h-2 w-2 rounded-full bg-primary-500/80 animate-pulse"></span>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {title}
                </p>
            </div>
            <ul className="flex flex-wrap gap-2.5">
                {items.map((item) => (
                    <li
                        key={item}
                        className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-600/50 dark:bg-slate-700/50 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                    >
                        {item}
                    </li>
                ))}
            </ul>
        </section>
    );
}
