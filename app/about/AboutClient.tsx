'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';
import {
    BookOpen,
    Globe,
    Brain,
    Target,
    Sparkles,
    Users,
    GraduationCap,
    ArrowRight,
    Github,
    Linkedin,
    Mail,
    Send,
} from 'lucide-react';
import TelegramBanner from '@/components/TelegramBanner';


export default function AboutPage() {
    const { language } = useLanguage();

    const content = {
        tr: {
            title: 'Hakkında',
            subtitle: 'FinTechTerms Projesi',
            description: 'Fintek, ekonomi ve bilişim terminolojisini üç dilde öğrenmek için tasarlanmış akademik bir eğitim platformu.',
            mission: {
                title: 'Misyonumuz',
                text: 'Finansal teknoloji ve ekonomi alanlarında çalışan profesyoneller, akademisyenler ve öğrenciler için kapsamlı, çok dilli bir terminoloji öğrenme aracı sunmak.',
            },
            features: {
                title: 'Özellikler',
                items: [
                    { icon: Brain, title: 'SRS Algoritması', desc: 'Leitner sistemi tabanlı aralıklı tekrar ile kalıcı öğrenme' },
                    { icon: Globe, title: 'Trilingual', desc: 'Türkçe, İngilizce ve Rusça tam destek' },
                    { icon: Target, title: 'Hedefli Öğrenme', desc: 'Fintech, finans ve teknoloji odaklı 95+ terim' },
                    { icon: Sparkles, title: 'Modern Arayüz', desc: 'PWA destekli, mobil uyumlu tasarım' },
                    { icon: Send, title: 'Telegram Bot', desc: 'Quiz, sesli telaffuz ve günlük terim — Telegram\'dan' },
                ],
            },
            academic: {
                title: 'Akademik Amaç',
                text: 'Bu proje, Yönetim Bilişim Sistemleri ve Ekonomi alanlarında akademik araştırma amacıyla geliştirilmiştir. Spaced Repetition System (SRS) metodolojisinin ekonomi terminolojisi öğrenimindeki etkinliğini ölçmek için tasarlanmıştır.',
                points: [
                    'SRS tabanlı öğrenme etkinliğinin analizi',
                    'Çok dilli terim edinimi karşılaştırması',
                    'Kullanıcı öğrenme davranışı modelleme',
                    'Kategori bazlı zorluk analizi',
                ],
            },
            tech: {
                title: 'Teknolojiler',
                items: ['Next.js 16', 'React 18', 'TypeScript', 'Tailwind CSS', 'Supabase', 'Vercel'],
            },
            methodology: 'Metodoloji',
            methodologyDesc: 'SRS algoritması ve Leitner sistemi hakkında detaylı bilgi için:',
            viewMethodology: 'Metodolojiyi İncele',
            contact: {
                title: 'İletişim',
                text: 'Proje hakkında sorularınız veya iş birliği önerileriniz için:',
            },
            footer: {
                version: 'Versiyon',
                terms: 'terim',
                languages: 'dil',
                categories: 'kategori',
            },
        },
        en: {
            title: 'About',
            subtitle: 'FinTechTerms Project',
            description: 'An academic educational platform designed to learn fintech, economics, and IT terminology in three languages.',
            mission: {
                title: 'Our Mission',
                text: 'To provide a comprehensive, multilingual terminology learning tool for professionals, academics, and students working in financial technology and economics.',
            },
            features: {
                title: 'Features',
                items: [
                    { icon: Brain, title: 'SRS Algorithm', desc: 'Long-term retention with Leitner system-based spaced repetition' },
                    { icon: Globe, title: 'Trilingual', desc: 'Full support for Turkish, English, and Russian' },
                    { icon: Target, title: 'Focused Learning', desc: '95+ terms focused on Fintech, Finance, and Technology' },
                    { icon: Sparkles, title: 'Modern Interface', desc: 'PWA-enabled, mobile-responsive design' },
                    { icon: Send, title: 'Telegram Bot', desc: 'Quizzes, voice pronunciation and daily terms — via Telegram' },
                ],
            },
            academic: {
                title: 'Academic Purpose',
                text: 'This project was developed for academic research in Management Information Systems and Economics. It is designed to measure the effectiveness of the Spaced Repetition System (SRS) methodology in learning economics terminology.',
                points: [
                    'Analysis of SRS-based learning effectiveness',
                    'Multilingual term acquisition comparison',
                    'User learning behavior modeling',
                    'Category-based difficulty analysis',
                ],
            },
            tech: {
                title: 'Technologies',
                items: ['Next.js 16', 'React 18', 'TypeScript', 'Tailwind CSS', 'Supabase', 'Vercel'],
            },
            methodology: 'Methodology',
            methodologyDesc: 'For detailed information about SRS algorithm and Leitner system:',
            viewMethodology: 'View Methodology',
            contact: {
                title: 'Contact',
                text: 'For questions about the project or collaboration proposals:',
            },
            footer: {
                version: 'Version',
                terms: 'terms',
                languages: 'languages',
                categories: 'categories',
            },
        },
        ru: {
            title: 'О проекте',
            subtitle: 'Проект FinTechTerms',
            description: 'Академическая образовательная платформа для изучения терминологии финтеха, экономики и IT на трёх языках.',
            mission: {
                title: 'Наша миссия',
                text: 'Предоставить комплексный многоязычный инструмент для изучения терминологии профессионалам, учёным и студентам в области финансовых технологий и экономики.',
            },
            features: {
                title: 'Возможности',
                items: [
                    { icon: Brain, title: 'Алгоритм SRS', desc: 'Долгосрочное запоминание с системой Лейтнера' },
                    { icon: Globe, title: 'Три языка', desc: 'Полная поддержка турецкого, английского и русского' },
                    { icon: Target, title: 'Целевое обучение', desc: '95+ терминов: финтех, финансы, технологии' },
                    { icon: Sparkles, title: 'Современный интерфейс', desc: 'PWA, адаптивный дизайн' },
                    { icon: Send, title: 'Telegram Бот', desc: 'Тесты, произношение и термин дня — прямо в Telegram' },
                ],
            },
            academic: {
                title: 'Академическая цель',
                text: 'Проект разработан для академических исследований в области информационных систем управления и экономики. Он предназначен для измерения эффективности методологии SRS в изучении экономической терминологии.',
                points: [
                    'Анализ эффективности обучения на основе SRS',
                    'Сравнение усвоения терминов на разных языках',
                    'Моделирование поведения пользователей',
                    'Анализ сложности по категориям',
                ],
            },
            tech: {
                title: 'Технологии',
                items: ['Next.js 16', 'React 18', 'TypeScript', 'Tailwind CSS', 'Supabase', 'Vercel'],
            },
            methodology: 'Методология',
            methodologyDesc: 'Подробная информация об алгоритме SRS и системе Лейтнера:',
            viewMethodology: 'Изучить методологию',
            contact: {
                title: 'Контакты',
                text: 'Для вопросов о проекте или предложений о сотрудничестве:',
            },
            footer: {
                version: 'Версия',
                terms: 'терминов',
                languages: 'языков',
                categories: 'категорий',
            },
        },
    };

    const t = content[language];

    return (
        <div className="page-content px-4 py-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'AboutPage',
                        name: 'About FinTechTerms',
                        description: content.en.description,
                        mainEntity: {
                            '@type': 'Organization',
                            name: 'FinTechTerms',
                            foundingDate: '2024',
                            description: content.en.mission.text
                        }
                    }),
                }}
            />
            {/* Header */}
            <header className="text-center mb-8">
                <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-2xl mb-4">
                    <GraduationCap className="w-10 h-10 text-primary-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{t.title}</h1>
                <p className="text-lg font-semibold text-primary-500">{t.subtitle}</p>
                <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">{t.description}</p>
            </header>

            {/* Mission */}
            <section className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 text-white mb-6 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                    <Users className="w-6 h-6" />
                    <h2 className="text-lg font-bold">{t.mission.title}</h2>
                </div>
                <p className="text-white/90 text-sm leading-relaxed">{t.mission.text}</p>
            </section>

            {/* Features */}
            <section className="mb-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t.features.title}</h2>
                <div className="grid grid-cols-2 gap-3">
                    {t.features.items.map((item, i) => (
                        <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <div className="p-2 bg-primary-50 rounded-lg w-fit mb-3">
                                <item.icon className="w-5 h-5 text-primary-500" />
                            </div>
                            <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.title}</h3>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Academic Purpose */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-accent-100 rounded-lg">
                        <BookOpen className="w-5 h-5 text-accent-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{t.academic.title}</h2>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{t.academic.text}</p>
                <ul className="space-y-2">
                    {t.academic.points.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="text-primary-500 mt-1">•</span>
                            {point}
                        </li>
                    ))}
                </ul>
            </section>

            {/* Methodology Link */}
            <section className="bg-gray-50 rounded-2xl p-5 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">{t.methodology}</h3>
                <p className="text-sm text-gray-500 mb-4">{t.methodologyDesc}</p>
                <Link
                    href="/methodology"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors"
                >
                    <Brain className="w-4 h-4" />
                    {t.viewMethodology}
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </section>

            {/* Technologies */}
            <section className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t.tech.title}</h2>
                <div className="flex flex-wrap gap-2">
                    {t.tech.items.map((tech, i) => (
                        <span
                            key={i}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-full"
                        >
                            {tech}
                        </span>
                    ))}
                </div>
            </section>

            {/* Telegram Bot CTA */}
            <section className="mb-6">
                <TelegramBanner variant="compact" />
            </section>

            {/* Contact */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-2">{t.contact.title}</h2>
                <p className="text-sm text-gray-500 mb-4">{t.contact.text}</p>
                <div className="flex gap-3">
                    <a
                        href="mailto:contact@fintechterms.com"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        <Mail className="w-4 h-4" />
                        Email
                    </a>
                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        <Github className="w-4 h-4" />
                        GitHub
                    </a>
                    <a
                        href="https://linkedin.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        <Linkedin className="w-4 h-4" />
                        LinkedIn
                    </a>
                </div>
            </section>

            {/* Footer Stats */}
            <footer className="text-center">
                <div className="flex items-center justify-center gap-4 text-sm text-gray-400 mb-2">
                    <span>v0.1.0</span>
                    <span>•</span>
                    <span>95+ {t.footer.terms}</span>
                    <span>•</span>
                    <span>3 {t.footer.languages}</span>
                    <span>•</span>
                    <span>3 {t.footer.categories}</span>
                </div>
                <p className="text-xs text-gray-400">© 2026 FinTechTerms</p>
            </footer>
        </div>
    );
}
