'use client';

import React from 'react';
import { ArrowUpRight, BellRing, BookOpen, Database, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const TELEGRAM_BOT_URL = 'https://t.me/FinTechTermsBot';

interface TelegramBannerProps {
    /** 'full' = big gradient card (home), 'compact' = slim inline banner (profile/about) */
    variant?: 'full' | 'compact';
}

const contentByLanguage = {
    tr: {
        badge: 'Ekosistem entegrasyonu',
        title: 'Telegram API entegrasyonu',
        subtitle: 'Bildirimler ve uzaktan erişim için profesyonel kanal',
        description: 'Telegram, FinTechTerms akademik altyapısının bir parçası olarak çalışır: tekrar döngülerini bildirir, terim tabanına hızlı erişim açar ve reklam tonu olmadan çalışma senaryolarını destekler.',
        cta: 'Entegrasyonu aç',
        features: ['SRS bildirimleri', 'Günün terimi', 'Uzaktan erişim'],
    },
    en: {
        badge: 'Ecosystem integration',
        title: 'Telegram API integration',
        subtitle: 'A professional channel for notifications and remote access',
        description: 'Telegram operates as part of the FinTechTerms academic infrastructure: it notifies review cycles, opens fast access to the terminology base, and supports study workflows without a promotional tone.',
        cta: 'Open integration',
        features: ['SRS notifications', 'Term of the day', 'Remote access'],
    },
    ru: {
        badge: 'Интеграция экосистемы',
        title: 'Интеграция API Telegram',
        subtitle: 'Профессиональный канал уведомлений и удалённого доступа',
        description: 'Telegram работает как часть академической инфраструктуры FinTechTerms: уведомляет о циклах повторения, открывает быстрый доступ к терминологической базе и поддерживает синхронизацию учебных сценариев без рекламной подачи.',
        cta: 'Открыть интеграцию',
        features: ['SRS-уведомления', 'Термин дня', 'Удалённый доступ'],
    },
} as const;

const featureIcons = [BellRing, BookOpen, Database];

export default function TelegramBanner({ variant = 'full' }: TelegramBannerProps) {
    const { language } = useLanguage();
    const content = contentByLanguage[language] ?? contentByLanguage.en;

    if (variant === 'compact') {
        return (
            <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm transition-all duration-300 hover:border-sky-200 hover:bg-sky-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                    <MessageCircle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            {content.badge}
                        </span>
                    </div>
                    <p className="truncate text-sm font-semibold">{content.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{content.subtitle}</p>
                </div>
                <ArrowUpRight className="h-5 w-5 flex-shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-600 dark:group-hover:text-sky-300" />
            </a>
        );
    }

    return (
        <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <div className="absolute inset-y-0 right-0 w-48 bg-[radial-gradient(circle_at_center,rgba(14,116,144,0.12),transparent_72%)]" />

            <div className="relative z-10">
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {content.badge}
                </span>

                <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {content.title}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {content.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                    {content.features.map((feature, index) => {
                        const Icon = featureIcons[index] ?? BookOpen;
                        return (
                            <span
                                key={feature}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {feature}
                            </span>
                        );
                    })}
                </div>

                <a
                    href={TELEGRAM_BOT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group mt-6 inline-flex items-center gap-2.5 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-sky-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-sky-200"
                >
                    <MessageCircle className="w-5 h-5" />
                    {content.cta}
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
            </div>
        </section>
    );
}
