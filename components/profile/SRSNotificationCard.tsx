'use client';

import { BellRing, BrainCircuit, CalendarClock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatUtcDateForLocale } from '@/lib/time';

interface SRSNotificationCardProps {
    dueCount: number;
    lastReviewDate?: string | null;
    variant?: 'full' | 'compact';
}

const localeByLanguage = {
    tr: 'tr-TR',
    en: 'en-US',
    ru: 'ru-RU',
} as const;

const copyByLanguage = {
    tr: {
        badge: 'Akademik SRS bildirimi',
        compactTitle: 'Bir sonraki tekrar bildirimi',
        title: 'Bir sonraki tekrar, Ebbinghaus aralıklı tekrar algoritmalarıyla planlanır.',
        description: 'Platform; cevap ritmi, tekrar yoğunluğu ve akademik pekiştirme döngüsüne göre yeni çalışma penceresini yeniden hesaplar. Böylece arayüz, tüketici tipi seri mantığı yerine araştırma odaklı bir çalışma akışına geçer.',
        nextWindowLabel: 'Sonraki pencere',
        readySuffix: 'tekrar için hazır',
        synced: 'senkronize edildi',
        pendingFirstReview: 'ilk çalışma oturumundan sonra hesaplanacak',
        autoUpdating: 'otomatik olarak güncelleniyor',
        lastCalibrationLabel: 'Son kalibrasyon',
        dueMessage: (count: number) => `Şu anda ${count} terim bir sonraki tekrar döngüsü için hazır.`,
        syncedMessage: 'Tekrar kuyruğu senkronize edildi. Yeni pencere, bir sonraki çalışma oturumundan sonra hesaplanacak.',
    },
    en: {
        badge: 'Academic SRS notification',
        compactTitle: 'Next review notification',
        title: 'The next review is scheduled by Ebbinghaus spaced-repetition algorithms.',
        description: 'The platform recalculates the next review window based on answer quality, repetition density, and the academic reinforcement cycle. This keeps the interface in a research-oriented study mode instead of consumer-style streak mechanics.',
        nextWindowLabel: 'Next window',
        readySuffix: 'ready for review',
        synced: 'synchronized',
        pendingFirstReview: 'scheduled after the first study session',
        autoUpdating: 'updating automatically',
        lastCalibrationLabel: 'Last calibration',
        dueMessage: (count: number) => `${count} terms are currently ready for the next review cycle.`,
        syncedMessage: 'The review queue is synchronized. A new window will be calculated after the next study session.',
    },
    ru: {
        badge: 'Академическое SRS-уведомление',
        compactTitle: 'Уведомление о следующем повторе',
        title: 'Следующее повторение назначается алгоритмами интервального повторения Эббингауза.',
        description: 'Платформа пересчитывает следующее окно обзора на основе динамики ответов, плотности повторений и академического цикла закрепления терминологии. Это переводит интерфейс в исследовательский режим вместо потребительской механики серий.',
        nextWindowLabel: 'Следующее окно',
        readySuffix: 'к повтору',
        synced: 'синхронизировано',
        pendingFirstReview: 'ожидается после первой учебной сессии',
        autoUpdating: 'обновляется автоматически',
        lastCalibrationLabel: 'Последняя калибровка',
        dueMessage: (count: number) => `Сейчас к следующему циклу повтора готовы ${count} терминов.`,
        syncedMessage: 'Очередь повторения синхронизирована. Новое окно будет рассчитано после следующей учебной сессии.',
    },
} as const;

const formatReviewDate = (
    value: string | null | undefined,
    locale: string,
    fallback: string,
    invalidFallback: string
): string => {
    if (!value) {
        return fallback;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return invalidFallback;
    }

    return formatUtcDateForLocale(date, locale);
};

export default function SRSNotificationCard({
    dueCount,
    lastReviewDate,
    variant = 'full',
}: SRSNotificationCardProps) {
    const { language } = useLanguage();
    const copy = copyByLanguage[language] ?? copyByLanguage.en;
    const locale = localeByLanguage[language] ?? localeByLanguage.en;
    const statusLine = dueCount > 0
        ? copy.dueMessage(dueCount)
        : copy.syncedMessage;
    const lastReviewLabel = formatReviewDate(
        lastReviewDate,
        locale,
        copy.pendingFirstReview,
        copy.autoUpdating
    );

    if (variant === 'compact') {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-slate-900 p-3 text-white dark:bg-slate-100 dark:text-slate-900">
                        <BrainCircuit className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {copy.badge}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {copy.compactTitle}
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
                    {copy.badge}
                </div>

                <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                            {copy.title}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {copy.description}
                        </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 lg:min-w-[280px]">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-slate-900 p-3 text-white dark:bg-slate-100 dark:text-slate-900">
                                <CalendarClock className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                    {copy.nextWindowLabel}
                                </p>
                                <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                                    {dueCount > 0 ? `${dueCount} ${copy.readySuffix}` : copy.synced}
                                </p>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {statusLine}
                        </p>
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            {copy.lastCalibrationLabel}: {lastReviewLabel}.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
