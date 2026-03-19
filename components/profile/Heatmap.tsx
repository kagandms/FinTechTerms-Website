import type { Language } from '@/types';
import type { LearningHeatmapEntry } from '@/types/gamification';

interface HeatmapProps {
    entries: LearningHeatmapEntry[];
    language: Language;
}

const locales: Record<Language, string> = {
    tr: 'tr-TR',
    en: 'en-US',
    ru: 'ru-RU',
};

const copy = {
    tr: {
        title: '365 Günlük Öğrenme Isı Haritası',
        description: 'Gün bazında öğrenme yoğunluğun.',
        activeDays: 'aktif gün',
        totalActivity: 'toplam aktivite',
        legendLess: 'Az',
        legendMore: 'Çok',
        empty: 'Henüz kayıtlı çalışma günü yok.',
    },
    en: {
        title: '365-Day Learning Heatmap',
        description: 'Your daily learning intensity at a glance.',
        activeDays: 'active days',
        totalActivity: 'total activity',
        legendLess: 'Less',
        legendMore: 'More',
        empty: 'No study days recorded yet.',
    },
    ru: {
        title: 'Тепловая карта за 365 дней',
        description: 'Ежедневная интенсивность обучения.',
        activeDays: 'активных дней',
        totalActivity: 'всего активности',
        legendLess: 'Меньше',
        legendMore: 'Больше',
        empty: 'Пока нет записанных учебных дней.',
    },
};

const weekdayLabels: Record<Language, string[]> = {
    tr: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
};

const levelClasses = [
    'bg-[var(--bg-primary)] border border-[var(--border-color)]',
    'bg-primary-100 border border-primary-200 dark:bg-primary-900/70 dark:border-primary-800',
    'bg-primary-200 border border-primary-300 dark:bg-primary-800 dark:border-primary-700',
    'bg-primary-400 border border-primary-500 dark:bg-primary-600 dark:border-primary-500',
    'bg-accent-500 border border-accent-600 dark:bg-accent-500 dark:border-accent-400',
];

const toDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDate = (value: string): Date => new Date(`${value}T00:00:00`);

const startOfWeekMonday = (date: Date): Date => {
    const clone = new Date(date);
    const offset = (clone.getDay() + 6) % 7;
    clone.setDate(clone.getDate() - offset);
    clone.setHours(0, 0, 0, 0);
    return clone;
};

const getLevel = (activity: number, maxActivity: number): number => {
    if (activity <= 0 || maxActivity <= 0) {
        return 0;
    }

    const ratio = activity / maxActivity;

    if (ratio >= 0.75) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
};

export default function Heatmap({ entries, language }: HeatmapProps) {
    const t = copy[language];
    const locale = locales[language];
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'short' });
    const dayFormatter = new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    const sortedEntries = [...entries].sort((left, right) => left.log_date.localeCompare(right.log_date));
    const firstEntry = sortedEntries[0];
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const firstDate = firstEntry ? parseDate(firstEntry.log_date) : new Date();
    const lastDate = lastEntry ? parseDate(lastEntry.log_date) : new Date();
    const gridStart = startOfWeekMonday(firstDate);
    const entryMap = new Map(sortedEntries.map((entry) => [entry.log_date, entry]));

    const gridEntries: LearningHeatmapEntry[] = [];
    const cursor = new Date(gridStart);

    while (cursor <= lastDate) {
        const dateKey = toDateKey(cursor);
        gridEntries.push(
            entryMap.get(dateKey) ?? {
                log_date: dateKey,
                words_reviewed: 0,
                words_correct: 0,
                words_incorrect: 0,
                new_words_learned: 0,
                time_spent_seconds: 0,
                time_spent_ms: 0,
                session_count: 0,
                activity_count: 0,
            }
        );

        cursor.setDate(cursor.getDate() + 1);
    }

    const weeks: LearningHeatmapEntry[][] = [];
    for (let index = 0; index < gridEntries.length; index += 7) {
        weeks.push(gridEntries.slice(index, index + 7));
    }

    const monthLabels = weeks.map((week, index) => {
        const fallbackDate = toDateKey(new Date());
        const monthDate = parseDate(week[0]?.log_date ?? fallbackDate);
        const previousMonthDate = index > 0
            ? parseDate(weeks[index - 1]?.[0]?.log_date ?? week[0]?.log_date ?? fallbackDate)
            : null;

        if (!previousMonthDate || previousMonthDate.getMonth() !== monthDate.getMonth()) {
            return monthFormatter.format(monthDate);
        }

        return '';
    });

    const maxActivity = sortedEntries.reduce(
        (max, entry) => Math.max(max, entry.activity_count),
        0
    );
    const activeDays = sortedEntries.filter((entry) => entry.activity_count > 0).length;
    const totalActivity = sortedEntries.reduce((sum, entry) => sum + entry.activity_count, 0);

    return (
        <section className="rounded-[1.75rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-card">
            <div className="flex flex-col gap-2 border-b border-[var(--border-color)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t.title}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">{t.description}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                    <span>
                        <strong className="font-semibold text-[var(--text-primary)]">{activeDays}</strong> {t.activeDays}
                    </span>
                    <span>
                        <strong className="font-semibold text-[var(--text-primary)]">{totalActivity}</strong> {t.totalActivity}
                    </span>
                </div>
            </div>

            <div className="mt-5 overflow-x-auto">
                <div className="min-w-[760px]">
                    <div className="mb-2 grid grid-cols-[auto_1fr] gap-2">
                        <div />
                        <div className="grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
                            {monthLabels.map((label, index) => (
                                <span
                                    key={`month-${index}`}
                                    className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]"
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-[auto_1fr] gap-2">
                        <div className="grid grid-rows-7 gap-1 pr-2 pt-1">
                            {weekdayLabels[language].map((label, index) => (
                                <span
                                    key={label}
                                    className="flex h-3 items-center text-[11px] text-[var(--text-tertiary)]"
                                >
                                    {index % 2 === 0 ? label : ''}
                                </span>
                            ))}
                        </div>

                        <div
                            className="grid gap-1"
                            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
                        >
                            {weeks.map((week, weekIndex) => (
                                <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1">
                                    {week.map((entry) => {
                                        const level = getLevel(entry.activity_count, maxActivity);
                                        const tooltip = `${dayFormatter.format(parseDate(entry.log_date))}: ${entry.activity_count}`;

                                        return (
                                            <div
                                                key={entry.log_date}
                                                aria-label={tooltip}
                                                className={`h-3 w-3 rounded-[4px] transition-transform hover:scale-110 ${levelClasses[level]}`}
                                                title={tooltip}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-sm text-[var(--text-secondary)]">
                    {activeDays > 0 ? `${activeDays}/365` : t.empty}
                </p>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                    <span>{t.legendLess}</span>
                    {levelClasses.map((className, index) => (
                        <span key={`legend-${index}`} className={`h-3 w-3 rounded-[4px] ${className}`} />
                    ))}
                    <span>{t.legendMore}</span>
                </div>
            </div>
        </section>
    );
}
