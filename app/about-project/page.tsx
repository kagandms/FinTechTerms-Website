'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Database, Server, Smartphone, Globe, Code, Cpu } from 'lucide-react';
import Link from 'next/link';

export default function AboutProjectPage() {
    const { t, language } = useLanguage();

    const isRu = language === 'ru';

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="p-2 -ml-2 text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="font-semibold text-lg text-gray-800">
                        {isRu ? 'О Проекте' : 'Project Architecture'}
                    </h1>
                    <div className="w-10" /> {/* Spacer */}
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-8">

                {/* 1. Abstract */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-primary-600" />
                        {isRu ? 'Аннотация' : 'Abstract'}
                    </h2>
                    <p className="text-gray-600 leading-relaxed text-sm">
                        {isRu
                            ? 'FinTechTerms - это специализированная система управления обучением (LMS), разработанная для анализа освоения финансовой терминологии. Проект использует алгоритмы интервального повторения (SRS) и синтетическое моделирование данных для исследования когнитивной нагрузки при изучении трехъязычной (TR-EN-RU) лексики в сфере FinTech.'
                            : 'FinTechTerms is a specialized Learning Management System (LMS) designed to analyze financial terminology acquisition. The project utilizes Spaced Repetition Algorithms (SRS) and synthetic data simulation to research cognitive load in trilingual (TR-EN-RU) lexical acquisition within the FinTech domain.'}
                    </p>
                </section>

                {/* 2. Technical Architecture */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 ml-1 flex items-center gap-2">
                        <Server className="w-5 h-5 text-blue-600" />
                        {isRu ? 'Системная Архитектура' : 'System Architecture'}
                    </h2>

                    {/* Visual Diagram */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 text-sm relative overflow-hidden">

                        {/* Client Layer */}
                        <div className="border border-blue-100 bg-blue-50/50 p-4 rounded-xl relative">
                            <div className="absolute top-2 right-2 text-xs font-mono text-blue-400">CLIENT SIDE</div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                    <Smartphone className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-800">Next.js App Router</div>
                                    <div className="text-xs text-gray-500">React 18 • TypeScript • Tailwind</div>
                                </div>
                            </div>
                            <div className="pl-4 border-l-2 border-blue-200 ml-4 mt-2 mb-2 space-y-1">
                                <div className="text-xs text-gray-600 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                    SRS Algorithm Engine
                                </div>
                                <div className="text-xs text-gray-600 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                    Synthetic Data Generator
                                </div>
                            </div>
                        </div>

                        {/* Connection */}
                        <div className="flex justify-center -my-2 z-10">
                            <div className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-mono text-gray-500 border border-gray-200">
                                REST API / WEBSOCKETS
                            </div>
                        </div>

                        {/* Server Layer */}
                        <div className="border border-emerald-100 bg-emerald-50/50 p-4 rounded-xl relative">
                            <div className="absolute top-2 right-2 text-xs font-mono text-emerald-400">SERVERLESS</div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                    <Database className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-800">Supabase (PostgreSQL)</div>
                                    <div className="text-xs text-gray-500">Auth • Database • Realtime</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <div className="bg-white p-2 text-center rounded border border-emerald-100">
                                    <div className="text-[10px] uppercase text-gray-400">Records</div>
                                    <div className="font-mono font-bold text-emerald-600">50K+</div>
                                </div>
                                <div className="bg-white p-2 text-center rounded border border-emerald-100">
                                    <div className="text-[10px] uppercase text-gray-400">Terms</div>
                                    <div className="font-mono font-bold text-emerald-600">505</div>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Layer */}
                        <div className="flex justify-center -my-2 z-10">
                            <div className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-mono text-gray-500 border border-gray-200">
                                PYTHON ETL
                            </div>
                        </div>

                        <div className="border border-amber-100 bg-amber-50/50 p-4 rounded-xl relative">
                            <div className="absolute top-2 right-2 text-xs font-mono text-amber-400">ANALYSIS</div>
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                    <Cpu className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-800">Python Simulation</div>
                                    <div className="text-xs text-gray-500">Pandas • Faker • NumPy</div>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* 3. Tech Stack Grid */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 ml-1 flex items-center gap-2">
                        <Code className="w-5 h-5 text-purple-600" />
                        {isRu ? 'Технологический Стек' : 'Tech Stack'}
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { name: 'TypeScript', desc: 'Type Safety', color: 'bg-blue-50 text-blue-700 border-blue-100' },
                            { name: 'Next.js 14', desc: 'App Router', color: 'bg-gray-50 text-gray-700 border-gray-100' },
                            { name: 'TailwindCSS', desc: 'Utility First', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
                            { name: 'Supabase', desc: 'PostgreSQL', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                            { name: 'Python', desc: 'Data Sim', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
                            { name: 'Faker.js', desc: 'Synthetic Data', color: 'bg-purple-50 text-purple-700 border-purple-100' },
                        ].map((tech) => (
                            <div key={tech.name} className={`${tech.color} border p-3 rounded-xl transition-all hover:scale-[1.02]`}>
                                <div className="font-bold text-sm">{tech.name}</div>
                                <div className="text-xs opacity-75">{tech.desc}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer for Academic Context */}
                <div className="text-center pt-8 border-t border-gray-100 mt-8">
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 origin-left scale-90">
                        Designed for MIS Portfolio Analysis
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
