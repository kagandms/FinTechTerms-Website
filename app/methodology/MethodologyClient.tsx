'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';
import { getTranslationValue } from '@/lib/i18n';
import {
    Brain,
    ArrowLeft,
    Clock,
    TrendingUp,
    RefreshCw,
    CheckCircle,
    XCircle,
    Box,
    Layers,
    BarChart3,
    Lightbulb,
} from 'lucide-react';

interface MethodologyBox {
    level: number;
    interval: string;
    desc: string;
}

interface MethodologyRule {
    title: string;
    desc: string;
}

interface MethodologyMetric {
    name: string;
    desc: string;
}

interface MethodologyCopy {
    title: string;
    subtitle: string;
    back: string;
    intro: {
        title: string;
        text: string;
    };
    forgettingCurve: {
        title: string;
        text: string;
        points: string[];
    };
    leitner: {
        title: string;
        text: string;
        boxLabel: string;
        boxes: MethodologyBox[];
    };
    algorithm: {
        title: string;
        text: string;
        rules: MethodologyRule[];
    };
    metrics: {
        title: string;
        items: MethodologyMetric[];
    };
    academic: {
        title: string;
        references: string[];
    };
    benefits: {
        title: string;
        items: string[];
    };
}

const boxColors = [
    'from-red-500 to-red-600',
    'from-orange-500 to-orange-600',
    'from-yellow-500 to-yellow-600',
    'from-green-500 to-green-600',
    'from-emerald-500 to-emerald-600',
] as const;

const algorithmRuleStyles = [
    { color: 'text-green-500', icon: CheckCircle },
    { color: 'text-red-500', icon: XCircle },
    { color: 'text-blue-500', icon: BarChart3 },
    { color: 'text-purple-500', icon: TrendingUp },
] as const;

export default function MethodologyPage() {
    const { language } = useLanguage();
    const copy = getTranslationValue(language, 'methodology') as MethodologyCopy;

    return (
        <div className="page-content px-4 py-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'TechArticle',
                        headline: 'Spaced Repetition System (SRS) Methodology',
                        description: copy.intro.text,
                        author: {
                            '@type': 'Organization',
                            name: 'FinTechTerms',
                        },
                        about: 'Educational Psychology',
                    }),
                }}
            />

            <Link
                href="/profile"
                className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                {copy.back}
            </Link>

            <header className="text-center mb-8">
                <div className="inline-flex items-center justify-center p-3 bg-primary-100 dark:bg-primary-900/30 rounded-2xl mb-4">
                    <Brain className="w-10 h-10 text-primary-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{copy.title}</h1>
                <p className="text-lg font-semibold text-primary-500 dark:text-primary-300">{copy.subtitle}</p>
            </header>

            <section className="app-surface rounded-2xl p-5 mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{copy.intro.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{copy.intro.text}</p>
            </section>

            <section className="rounded-2xl p-5 mb-6 border border-red-100 dark:border-red-900/40 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40">
                <div className="flex items-center gap-3 mb-4">
                    <Clock className="w-6 h-6 text-red-500" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{copy.forgettingCurve.title}</h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{copy.forgettingCurve.text}</p>
                <div className="bg-white/80 dark:bg-gray-900/50 rounded-xl p-4">
                    {copy.forgettingCurve.points.map((point, index) => (
                        <div key={point} className="flex items-center gap-2 py-1">
                            <div
                                className="h-2 rounded-full bg-red-400"
                                style={{ width: `${[56, 34, 25, 21][index] ?? 0}%` }}
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-200 whitespace-nowrap">{point}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <Layers className="w-6 h-6 text-primary-500" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{copy.leitner.title}</h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{copy.leitner.text}</p>

                <div className="space-y-3">
                    {copy.leitner.boxes.map((box, index) => (
                        <div
                            key={`${box.level}-${box.interval}`}
                            className={`bg-gradient-to-r ${boxColors[index] ?? boxColors[0]} rounded-xl p-4 text-white shadow-md`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <Box className="w-5 h-5" />
                                    <span className="font-bold">{copy.leitner.boxLabel} {box.level}</span>
                                </div>
                                <span className="text-sm font-medium bg-white/20 px-2 py-0.5 rounded-full">
                                    {box.interval}
                                </span>
                            </div>
                            <p className="text-sm text-white/90">{box.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="app-surface rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <RefreshCw className="w-6 h-6 text-primary-500" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{copy.algorithm.title}</h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{copy.algorithm.text}</p>

                <div className="grid grid-cols-2 gap-3">
                    {copy.algorithm.rules.map((rule, index) => {
                        const style = algorithmRuleStyles[index];
                        if (!style) {
                            return null;
                        }

                        const Icon = style.icon;

                        return (
                            <div key={rule.title} className="bg-gray-50 dark:bg-gray-700/60 rounded-xl p-3">
                                <Icon className={`w-5 h-5 ${style.color} mb-2`} />
                                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{rule.title}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-300">{rule.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-2xl p-5 mb-6 border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-6 h-6 text-slate-600" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{copy.metrics.title}</h2>
                </div>
                <div className="space-y-2">
                    {copy.metrics.items.map((item) => (
                        <div key={item.name} className="app-surface rounded-lg p-3 flex justify-between items-center">
                            <span className="font-mono text-sm text-primary-600 dark:text-primary-300">{item.name}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-300">{item.desc}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl p-5 mb-6 border border-green-100 dark:border-green-900/40 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40">
                <div className="flex items-center gap-3 mb-4">
                    <Lightbulb className="w-6 h-6 text-green-600" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{copy.benefits.title}</h2>
                </div>
                <ul className="space-y-2">
                    {copy.benefits.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-200">{item}</span>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="app-surface rounded-2xl p-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{copy.academic.title}</h2>
                <div className="space-y-2">
                    {copy.academic.references.map((reference) => (
                        <p key={reference} className="text-xs text-gray-500 dark:text-gray-300 italic pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                            {reference}
                        </p>
                    ))}
                </div>
            </section>
        </div>
    );
}
