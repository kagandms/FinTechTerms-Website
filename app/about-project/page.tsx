'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Database, Server, Smartphone, Globe, Code, Cpu } from 'lucide-react';
import Link from 'next/link';

export default function AboutProjectPage() {
    const { t } = useLanguage();
    const [termCount, setTermCount] = useState(500);

    // Fetch term count from API instead of direct Supabase call (Client Component)
    useEffect(() => {
        async function fetchCount() {
            try {
                const res = await fetch('/api/terms/count');
                if (res.ok) {
                    const data = await res.json();
                    setTermCount(data.count || 500);
                }
            } catch {
                // Keep default 500
            }
        }
        fetchCount();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="font-semibold text-lg text-gray-800 dark:text-white">
                        {t('aboutProject.pageTitle')}
                    </h1>
                    <div className="w-10" /> {/* Spacer */}
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-8">

                {/* 1. Abstract */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-primary-600" />
                        {t('aboutProject.abstractTitle')}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                        {t('aboutProject.abstractText')}
                    </p>
                </section>

                {/* 2. Technical Architecture */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 ml-1 flex items-center gap-2">
                        <Server className="w-5 h-5 text-blue-600" />
                        {t('aboutProject.architectureTitle')}
                    </h2>

                    {/* Visual Diagram */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-4 text-sm relative overflow-hidden">

                        {/* Client Layer */}
                        <div className="border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-xl relative">
                            <div className="absolute top-2 right-2 text-xs font-mono text-blue-400">{t('aboutProject.clientSide')}</div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm">
                                    <Smartphone className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-800 dark:text-white">{t('aboutProject.nextjsApp')}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('aboutProject.nextjsDesc')}</div>
                                </div>
                            </div>
                            <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-700 ml-4 mt-2 mb-2 space-y-1">
                                <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                    {t('aboutProject.srsEngine')}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                    {t('aboutProject.dataGenerator')}
                                </div>
                            </div>
                        </div>

                        {/* Connection */}
                        <div className="flex justify-center -my-2 z-10">
                            <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-[10px] font-mono text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                                {t('aboutProject.connection')}
                            </div>
                        </div>

                        {/* Server Layer */}
                        <div className="border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/20 p-4 rounded-xl relative">
                            <div className="absolute top-2 right-2 text-xs font-mono text-emerald-400">{t('aboutProject.serverless')}</div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm">
                                    <Database className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-800 dark:text-white">{t('aboutProject.supabase')}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('aboutProject.supabaseDesc')}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <div className="bg-white dark:bg-gray-700 p-2 text-center rounded border border-emerald-100 dark:border-emerald-800">
                                    <div className="text-[10px] uppercase text-gray-400">{t('aboutProject.records')}</div>
                                    <div className="font-mono font-bold text-emerald-600">50K+</div>
                                </div>
                                <div className="bg-white dark:bg-gray-700 p-2 text-center rounded border border-emerald-100 dark:border-emerald-800">
                                    <div className="text-[10px] uppercase text-gray-400">{t('aboutProject.terms')}</div>
                                    <div className="font-mono font-bold text-emerald-600">{termCount}</div>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Layer */}
                        <div className="flex justify-center -my-2 z-10">
                            <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-[10px] font-mono text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                                {t('aboutProject.pythonWorker')}
                            </div>
                        </div>

                        <div className="border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/20 p-4 rounded-xl relative">
                            <div className="absolute top-2 right-2 text-xs font-mono text-amber-400">{t('aboutProject.telegram')}</div>
                            <div className="flex items-center gap-3">
                                <div className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm">
                                    <Cpu className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-800 dark:text-white">{t('aboutProject.telegramBot')}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('aboutProject.telegramBotDesc')}</div>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* 3. Tech Stack Grid */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 ml-1 flex items-center gap-2">
                        <Code className="w-5 h-5 text-purple-600" />
                        {t('aboutProject.techStackTitle')}
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { name: 'TypeScript', desc: 'Type Safety', color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800' },
                            { name: 'Next.js 14', desc: 'App Router', color: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-600' },
                            { name: 'TailwindCSS', desc: 'Utility First', color: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-100 dark:border-cyan-800' },
                            { name: 'Supabase', desc: 'PostgreSQL', color: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800' },
                            { name: 'Python', desc: 'Data Bot', color: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-100 dark:border-yellow-800' },
                            { name: 'Redis', desc: 'Rate Limiting', color: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800' },
                        ].map((tech) => (
                            <div key={tech.name} className={`${tech.color} border p-3 rounded-xl transition-all hover:scale-[1.02]`}>
                                <div className="font-bold text-sm">{tech.name}</div>
                                <div className="text-xs opacity-75">{tech.desc}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer */}
                <div className="text-center pt-8 border-t border-gray-100 dark:border-gray-700 mt-8">
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 origin-left scale-90">
                        {t('aboutProject.footer')}
                    </p>
                    <div className="flex justify-center gap-2 opacity-30">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                    </div>
                </div>
            </div>
        </div>
    );
}
