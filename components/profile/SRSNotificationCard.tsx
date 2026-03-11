import { BellRing, BrainCircuit, CalendarClock } from 'lucide-react';

interface SRSNotificationCardProps {
    dueCount: number;
    lastReviewDate?: string | null;
    variant?: 'full' | 'compact';
}

const formatReviewDate = (value: string | null | undefined): string => {
    if (!value) {
        return 'ожидается после первой учебной сессии';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'обновляется автоматически';
    }

    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
};

export default function SRSNotificationCard({
    dueCount,
    lastReviewDate,
    variant = 'full',
}: SRSNotificationCardProps) {
    const statusLine = dueCount > 0
        ? `Сейчас к следующему циклу повтора готовы ${dueCount} терминов.`
        : 'Очередь повторения синхронизирована. Новое окно будет рассчитано после следующей учебной сессии.';
    const lastReviewLabel = formatReviewDate(lastReviewDate);

    if (variant === 'compact') {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-slate-900 p-3 text-white dark:bg-slate-100 dark:text-slate-900">
                        <BrainCircuit className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Алгоритм Эббингауза
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            SRS-уведомление о следующем повторе
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            {statusLine}
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,rgba(14,116,144,0.12),transparent_70%)]" />

            <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                    <BellRing className="h-3.5 w-3.5" />
                    Академическое SRS-уведомление
                </div>

                <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                            Следующее повторение назначается алгоритмами интервального повторения Эббингауза.
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            Платформа рассчитывает очередное окно обзора на основе динамики ответов, плотности повторений и академического цикла закрепления терминологии. Это заменяет потребительскую механику серии и переводит интерфейс в исследовательский режим.
                        </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 lg:min-w-[280px]">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-slate-900 p-3 text-white dark:bg-slate-100 dark:text-slate-900">
                                <CalendarClock className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                    Следующее окно
                                </p>
                                <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                                    {dueCount > 0 ? `${dueCount} к повтору` : 'синхронизировано'}
                                </p>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {statusLine}
                        </p>
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            Последняя калибровка: {lastReviewLabel}.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
