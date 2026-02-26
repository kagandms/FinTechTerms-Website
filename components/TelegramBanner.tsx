'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MessageCircle, Zap, BookOpen, Volume2, ArrowRight } from 'lucide-react';

const TELEGRAM_BOT_URL = 'https://t.me/FinTechTermsBot';

interface TelegramBannerProps {
    /** 'full' = big gradient card (home), 'compact' = slim inline banner (profile/about) */
    variant?: 'full' | 'compact';
}

const content = {
    tr: {
        badge: '🤖 YENİ',
        title: 'FinTechTerms Telegram Bot',
        subtitle: 'Terimleri Telegram\'dan öğren!',
        description: 'Quiz çöz, günün terimini al, sesli telaffuz dinle — hepsi Telegram\'dan.',
        cta: 'Bot\'u Aç',
        features: ['Günlük Terimler', 'Sesli Telaffuz', 'Anlık Quiz'],
    },
    en: {
        badge: '🤖 NEW',
        title: 'FinTechTerms Telegram Bot',
        subtitle: 'Learn terms right from Telegram!',
        description: 'Take quizzes, get daily terms, listen to pronunciation — all from Telegram.',
        cta: 'Open Bot',
        features: ['Daily Terms', 'Voice Pronunciation', 'Instant Quiz'],
    },
    ru: {
        badge: '🤖 НОВИНКА',
        title: 'FinTechTerms Telegram Бот',
        subtitle: 'Учи термины прямо в Telegram!',
        description: 'Проходи тесты, получай термин дня, слушай произношение — всё в Telegram.',
        cta: 'Открыть бота',
        features: ['Термин дня', 'Произношение', 'Мини-тесты'],
    },
};

const featureIcons = [BookOpen, Volume2, Zap];

export default function TelegramBanner({ variant = 'full' }: TelegramBannerProps) {
    const { language } = useLanguage();
    const t = content[language];

    if (variant === 'compact') {
        return (
            <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            >
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                            {t.badge}
                        </span>
                    </div>
                    <p className="font-bold text-sm truncate">{t.title}</p>
                    <p className="text-xs text-white/80 truncate">{t.subtitle}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </a>
        );
    }

    // ── Full variant (Home page) ──
    return (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-500/25">
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full" />
            <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/5 rounded-full" />

            <div className="relative z-10">
                {/* Badge */}
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full mb-4">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    {t.badge}
                </span>

                {/* Title */}
                <h3 className="text-xl font-extrabold mb-1 tracking-tight">
                    {t.title}
                </h3>
                <p className="text-sm text-white/80 mb-5 max-w-[280px] leading-relaxed">
                    {t.description}
                </p>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-2 mb-5">
                    {t.features.map((feat, i) => {
                        const Icon = featureIcons[i] ?? BookOpen;
                        return (
                            <span
                                key={feat}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium"
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {feat}
                            </span>
                        );
                    })}
                </div>

                {/* CTA Button */}
                <a
                    href={TELEGRAM_BOT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2.5 px-6 py-3 bg-white text-blue-600 font-bold text-sm rounded-2xl shadow-lg shadow-black/10 hover:shadow-xl hover:scale-105 transition-all duration-300 active:scale-95"
                >
                    <MessageCircle className="w-5 h-5" />
                    {t.cta}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
            </div>
        </section>
    );
}
