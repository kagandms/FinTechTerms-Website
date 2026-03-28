import React from 'react';

interface ValueHintListProps {
    title: string;
    items: readonly string[];
    tone?: 'subtle' | 'strong';
}

const wrapperClassNames: Record<NonNullable<ValueHintListProps['tone']>, string> = {
    subtle: 'rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200',
    strong: 'rounded-2xl border border-primary-200 bg-primary-50 p-4 text-slate-800 shadow-sm dark:border-primary-900/40 dark:bg-primary-950/40 dark:text-slate-100',
};

export default function ValueHintList({
    title,
    items,
    tone = 'subtle',
}: ValueHintListProps) {
    return (
        <section className={wrapperClassNames[tone]}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {title}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
                {items.map((item) => (
                    <li
                        key={item}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                        {item}
                    </li>
                ))}
            </ul>
        </section>
    );
}
