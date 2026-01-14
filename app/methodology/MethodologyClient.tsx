'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';
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


export default function MethodologyPage() {
    const { language } = useLanguage();

    const content = {
        tr: {
            title: 'Metodoloji',
            subtitle: 'SRS ve Leitner Sistemi',
            back: 'Geri',
            intro: {
                title: 'Aralıklı Tekrar Sistemi (SRS) Nedir?',
                text: 'Spaced Repetition System (SRS), bilginin uzun süreli hafızaya yerleşmesini optimize eden bilimsel bir öğrenme metodolojisidir. Hermann Ebbinghaus\'un "unutma eğrisi" araştırmasına dayanır.',
            },
            forgettingCurve: {
                title: 'Unutma Eğrisi',
                text: 'Ebbinghaus, yeni öğrenilen bilginin tekrar edilmezse hızla unutulduğunu keşfetti. Ancak stratejik zamanlarda yapılan tekrarlar, bilginin kalıcılığını dramatik şekilde artırır.',
                points: [
                    '1 saat sonra: %56 hatırlanır',
                    '1 gün sonra: %34 hatırlanır',
                    '1 hafta sonra: %25 hatırlanır',
                    '1 ay sonra: %21 hatırlanır',
                ],
            },
            leitner: {
                title: 'Leitner Sistemi',
                text: 'Sebastian Leitner tarafından 1970\'lerde geliştirilen bu sistem, flashcard\'ları zorluk seviyesine göre farklı kutulara ayırır.',
                boxes: [
                    { level: 1, interval: '1 gün', desc: 'Yeni veya yanlış bilinen kelimeler' },
                    { level: 2, interval: '3 gün', desc: 'Öğrenmeye başlanan kelimeler' },
                    { level: 3, interval: '1 hafta', desc: 'Öğrenme aşamasındaki kelimeler' },
                    { level: 4, interval: '2 hafta', desc: 'Pekiştirme aşamasındaki kelimeler' },
                    { level: 5, interval: '1 ay', desc: 'Ustalaşılmış kelimeler' },
                ],
            },
            algorithm: {
                title: 'FinTechTerms Algoritması',
                text: 'Uygulamamız, Leitner sistemini SuperMemo-2 algoritması ile güçlendirerek daha akıllı bir öğrenme deneyimi sunar.',
                rules: [
                    { icon: CheckCircle, title: 'Doğru Cevap', desc: 'Kelime bir üst kutuya yükselir', color: 'text-green-500' },
                    { icon: XCircle, title: 'Yanlış Cevap', desc: 'Kelime ilk kutuya geri döner', color: 'text-red-500' },
                    { icon: BarChart3, title: 'Zorluk Skoru', desc: 'Her kelime için dinamik zorluk hesaplanır', color: 'text-blue-500' },
                    { icon: TrendingUp, title: 'Hatırlama Oranı', desc: 'Kişisel başarı oranı takip edilir', color: 'text-purple-500' },
                ],
            },
            metrics: {
                title: 'Ölçülen Metrikler',
                items: [
                    { name: 'SRS Level', desc: 'Kelimenin mevcut kutu numarası (1-5)' },
                    { name: 'Difficulty Score', desc: 'Zorluk puanı (0.0 - 5.0)' },
                    { name: 'Retention Rate', desc: 'Hatırlama oranı (0% - 100%)' },
                    { name: 'Review Count', desc: 'Toplam tekrar sayısı' },
                    { name: 'Response Time', desc: 'Ortalama cevap süresi (ms)' },
                ],
            },
            academic: {
                title: 'Akademik Temel',
                references: [
                    'Ebbinghaus, H. (1885). Memory: A Contribution to Experimental Psychology',
                    'Leitner, S. (1972). So lernt man lernen',
                    'Pimsleur, P. (1967). A Memory Schedule',
                    'Wozniak, P. & Gorzelanczyk, E. (1994). Optimization of Repetition Spacing',
                ],
            },
            benefits: {
                title: 'SRS\'in Avantajları',
                items: [
                    'Öğrenme süresini %50 oranında azaltır',
                    'Uzun vadeli hatırlamayı %80+ seviyesinde tutar',
                    'Kişiselleştirilmiş öğrenme deneyimi sunar',
                    'Bilişsel yükü optimize eder',
                ],
            },
        },
        en: {
            title: 'Methodology',
            subtitle: 'SRS and Leitner System',
            back: 'Back',
            intro: {
                title: 'What is Spaced Repetition System (SRS)?',
                text: 'The Spaced Repetition System (SRS) is a scientifically proven learning methodology that optimizes the transfer of information to long-term memory. It is based on Hermann Ebbinghaus\'s "forgetting curve" research.',
            },
            forgettingCurve: {
                title: 'The Forgetting Curve',
                text: 'Ebbinghaus discovered that newly learned information is quickly forgotten if not reviewed. However, strategic reviews at specific intervals dramatically increase retention.',
                points: [
                    'After 1 hour: 56% retained',
                    'After 1 day: 34% retained',
                    'After 1 week: 25% retained',
                    'After 1 month: 21% retained',
                ],
            },
            leitner: {
                title: 'Leitner System',
                text: 'Developed by Sebastian Leitner in the 1970s, this system organizes flashcards into different boxes based on difficulty level.',
                boxes: [
                    { level: 1, interval: '1 day', desc: 'New or incorrectly answered cards' },
                    { level: 2, interval: '3 days', desc: 'Cards starting to be learned' },
                    { level: 3, interval: '1 week', desc: 'Cards in learning phase' },
                    { level: 4, interval: '2 weeks', desc: 'Cards in reviewing phase' },
                    { level: 5, interval: '1 month', desc: 'Mastered cards' },
                ],
            },
            algorithm: {
                title: 'FinTechTerms Algorithm',
                text: 'Our application enhances the Leitner system with the SuperMemo-2 algorithm for a smarter learning experience.',
                rules: [
                    { icon: CheckCircle, title: 'Correct Answer', desc: 'Card moves to the next box', color: 'text-green-500' },
                    { icon: XCircle, title: 'Wrong Answer', desc: 'Card returns to box 1', color: 'text-red-500' },
                    { icon: BarChart3, title: 'Difficulty Score', desc: 'Dynamic difficulty calculated per term', color: 'text-blue-500' },
                    { icon: TrendingUp, title: 'Retention Rate', desc: 'Personal success rate tracked', color: 'text-purple-500' },
                ],
            },
            metrics: {
                title: 'Measured Metrics',
                items: [
                    { name: 'SRS Level', desc: 'Current box number (1-5)' },
                    { name: 'Difficulty Score', desc: 'Difficulty rating (0.0 - 5.0)' },
                    { name: 'Retention Rate', desc: 'Recall rate (0% - 100%)' },
                    { name: 'Review Count', desc: 'Total number of reviews' },
                    { name: 'Response Time', desc: 'Average response time (ms)' },
                ],
            },
            academic: {
                title: 'Academic Foundation',
                references: [
                    'Ebbinghaus, H. (1885). Memory: A Contribution to Experimental Psychology',
                    'Leitner, S. (1972). So lernt man lernen',
                    'Pimsleur, P. (1967). A Memory Schedule',
                    'Wozniak, P. & Gorzelanczyk, E. (1994). Optimization of Repetition Spacing',
                ],
            },
            benefits: {
                title: 'Benefits of SRS',
                items: [
                    'Reduces learning time by up to 50%',
                    'Maintains long-term retention above 80%',
                    'Provides personalized learning experience',
                    'Optimizes cognitive load',
                ],
            },
        },
        ru: {
            title: 'Методология',
            subtitle: 'SRS и система Лейтнера',
            back: 'Назад',
            intro: {
                title: 'Что такое система интервального повторения (SRS)?',
                text: 'Spaced Repetition System (SRS) — это научно обоснованная методология обучения, оптимизирующая перенос информации в долговременную память. Основана на исследовании «кривой забывания» Германа Эббингауза.',
            },
            forgettingCurve: {
                title: 'Кривая забывания',
                text: 'Эббингауз обнаружил, что новая информация быстро забывается без повторения. Однако стратегические повторения в определённые интервалы значительно увеличивают удержание.',
                points: [
                    'Через 1 час: сохраняется 56%',
                    'Через 1 день: сохраняется 34%',
                    'Через 1 неделю: сохраняется 25%',
                    'Через 1 месяц: сохраняется 21%',
                ],
            },
            leitner: {
                title: 'Система Лейтнера',
                text: 'Разработанная Себастьяном Лейтнером в 1970-х годах, эта система распределяет карточки по разным коробкам в зависимости от уровня сложности.',
                boxes: [
                    { level: 1, interval: '1 день', desc: 'Новые или неправильно отвеченные карточки' },
                    { level: 2, interval: '3 дня', desc: 'Карточки в начале изучения' },
                    { level: 3, interval: '1 неделя', desc: 'Карточки в процессе изучения' },
                    { level: 4, interval: '2 недели', desc: 'Карточки на этапе повторения' },
                    { level: 5, interval: '1 месяц', desc: 'Освоенные карточки' },
                ],
            },
            algorithm: {
                title: 'Алгоритм FinTechTerms',
                text: 'Наше приложение усиливает систему Лейтнера алгоритмом SuperMemo-2 для более интеллектуального обучения.',
                rules: [
                    { icon: CheckCircle, title: 'Правильный ответ', desc: 'Карточка переходит в следующую коробку', color: 'text-green-500' },
                    { icon: XCircle, title: 'Неправильный ответ', desc: 'Карточка возвращается в коробку 1', color: 'text-red-500' },
                    { icon: BarChart3, title: 'Оценка сложности', desc: 'Динамический расчёт для каждого термина', color: 'text-blue-500' },
                    { icon: TrendingUp, title: 'Коэффициент удержания', desc: 'Отслеживание личного успеха', color: 'text-purple-500' },
                ],
            },
            metrics: {
                title: 'Измеряемые метрики',
                items: [
                    { name: 'SRS Level', desc: 'Номер текущей коробки (1-5)' },
                    { name: 'Difficulty Score', desc: 'Рейтинг сложности (0.0 - 5.0)' },
                    { name: 'Retention Rate', desc: 'Коэффициент запоминания (0% - 100%)' },
                    { name: 'Review Count', desc: 'Общее количество повторений' },
                    { name: 'Response Time', desc: 'Среднее время ответа (мс)' },
                ],
            },
            academic: {
                title: 'Академическая основа',
                references: [
                    'Ebbinghaus, H. (1885). Memory: A Contribution to Experimental Psychology',
                    'Leitner, S. (1972). So lernt man lernen',
                    'Pimsleur, P. (1967). A Memory Schedule',
                    'Wozniak, P. & Gorzelanczyk, E. (1994). Optimization of Repetition Spacing',
                ],
            },
            benefits: {
                title: 'Преимущества SRS',
                items: [
                    'Сокращает время обучения до 50%',
                    'Поддерживает долгосрочное запоминание выше 80%',
                    'Обеспечивает персонализированное обучение',
                    'Оптимизирует когнитивную нагрузку',
                ],
            },
        },
    };

    const t = content[language];

    const boxColors = [
        'from-red-500 to-red-600',
        'from-orange-500 to-orange-600',
        'from-yellow-500 to-yellow-600',
        'from-green-500 to-green-600',
        'from-emerald-500 to-emerald-600',
    ];

    return (
        <div className="page-content px-4 py-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'TechArticle',
                        headline: 'Spaced Repetition System (SRS) Methodology',
                        description: content.en.intro.text,
                        author: {
                            '@type': 'Organization',
                            name: 'FinTechTerms'
                        },
                        about: 'Educational Psychology'
                    }),
                }}
            />
            {/* Back Button */}
            <Link
                href="/about"
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                {t.back}
            </Link>

            {/* Header */}
            <header className="text-center mb-8">
                <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-2xl mb-4">
                    <Brain className="w-10 h-10 text-primary-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{t.title}</h1>
                <p className="text-lg font-semibold text-primary-500">{t.subtitle}</p>
            </header>

            {/* Introduction */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">{t.intro.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{t.intro.text}</p>
            </section>

            {/* Forgetting Curve */}
            <section className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-5 mb-6 border border-red-100">
                <div className="flex items-center gap-3 mb-4">
                    <Clock className="w-6 h-6 text-red-500" />
                    <h2 className="text-lg font-bold text-gray-900">{t.forgettingCurve.title}</h2>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{t.forgettingCurve.text}</p>
                <div className="bg-white/80 rounded-xl p-4">
                    {t.forgettingCurve.points.map((point, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                            <div
                                className="h-2 rounded-full bg-red-400"
                                style={{ width: `${[56, 34, 25, 21][i]}%` }}
                            />
                            <span className="text-xs text-gray-600 whitespace-nowrap">{point}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Leitner System */}
            <section className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <Layers className="w-6 h-6 text-primary-500" />
                    <h2 className="text-lg font-bold text-gray-900">{t.leitner.title}</h2>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{t.leitner.text}</p>

                <div className="space-y-3">
                    {t.leitner.boxes.map((box, i) => (
                        <div
                            key={i}
                            className={`bg-gradient-to-r ${boxColors[i]} rounded-xl p-4 text-white shadow-md`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <Box className="w-5 h-5" />
                                    <span className="font-bold">Box {box.level}</span>
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

            {/* Algorithm */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <RefreshCw className="w-6 h-6 text-primary-500" />
                    <h2 className="text-lg font-bold text-gray-900">{t.algorithm.title}</h2>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{t.algorithm.text}</p>

                <div className="grid grid-cols-2 gap-3">
                    {t.algorithm.rules.map((rule, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-3">
                            <rule.icon className={`w-5 h-5 ${rule.color} mb-2`} />
                            <h3 className="font-semibold text-gray-900 text-sm">{rule.title}</h3>
                            <p className="text-xs text-gray-500">{rule.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Metrics */}
            <section className="bg-slate-50 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-6 h-6 text-slate-600" />
                    <h2 className="text-lg font-bold text-gray-900">{t.metrics.title}</h2>
                </div>
                <div className="space-y-2">
                    {t.metrics.items.map((item, i) => (
                        <div key={i} className="bg-white rounded-lg p-3 flex justify-between items-center">
                            <span className="font-mono text-sm text-primary-600">{item.name}</span>
                            <span className="text-sm text-gray-500">{item.desc}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Benefits */}
            <section className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 mb-6 border border-green-100">
                <div className="flex items-center gap-3 mb-4">
                    <Lightbulb className="w-6 h-6 text-green-600" />
                    <h2 className="text-lg font-bold text-gray-900">{t.benefits.title}</h2>
                </div>
                <ul className="space-y-2">
                    {t.benefits.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{item}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Academic References */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t.academic.title}</h2>
                <div className="space-y-2">
                    {t.academic.references.map((ref, i) => (
                        <p key={i} className="text-xs text-gray-500 italic pl-4 border-l-2 border-gray-200">
                            {ref}
                        </p>
                    ))}
                </div>
            </section>
        </div>
    );
}
