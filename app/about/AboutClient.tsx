'use client';

import Link from 'next/link';
import {
    ArrowLeft,
    BookOpen,
    Brain,
    Database,
    GraduationCap,
    Landmark,
    Send,
    Server,
} from 'lucide-react';
import TelegramBanner from '@/components/TelegramBanner';

const architectureLayers = [
    {
        title: 'Интерфейс Next.js 16 App Router',
        description: 'Основной интерфейс платформы, серверные компоненты и исследовательские сценарии доступа к академической терминологии.',
        icon: Server,
    },
    {
        title: 'Supabase PostgreSQL и SSR-аутентификация',
        description: 'Единый контур данных, защищённые сессии, профиль исследователя и синхронизация пользовательского прогресса.',
        icon: Database,
    },
    {
        title: 'Слой SRS-уведомлений Эббингауза',
        description: 'Алгоритмический расчёт следующих окон повторения вместо потребительской механики серий и streak-геймификации.',
        icon: Brain,
    },
    {
        title: 'Интеграция API Telegram',
        description: 'Профессиональный канал уведомлений, удалённого доступа к терминам и распределённых академических сценариев.',
        icon: Send,
    },
];

const researchPillars = [
    {
        title: 'Постдипломный финансовый инструмент',
        description: 'FinTechTerms спроектирован как академический инструмент для магистерских и постдипломных программ, где финансовая терминология рассматривается как часть исследовательской инфраструктуры, а не как развлекательная практика.',
        icon: GraduationCap,
    },
    {
        title: 'Региональная таксономия рынков',
        description: 'Платформа развивает классификацию MOEX, BIST и GLOBAL, чтобы связать термины с конкретными институциональными и рыночными контекстами.',
        icon: Landmark,
    },
    {
        title: 'Русскоязычный академический контур',
        description: 'Интерфейс, уведомления и исследовательская логика ориентированы на русскоязычное академическое использование и профессиональную финансовую коммуникацию.',
        icon: BookOpen,
    },
];

export default function AboutClient() {
    return (
        <div className="page-content mx-auto max-w-5xl px-4 py-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'AboutPage',
                        name: 'FinTechTerms',
                        description: 'FinTechTerms — постдипломный финансовый инструмент для академического освоения терминологии, интервального повторения и региональной таксономии рынков.',
                        mainEntity: {
                            '@type': 'SoftwareApplication',
                            name: 'FinTechTerms',
                            applicationCategory: 'EducationalApplication',
                            operatingSystem: 'Web',
                        },
                    }),
                }}
            />

            <div className="mb-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Вернуться на главную
                </Link>
            </div>

            <header className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-8 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                <div className="absolute inset-y-0 right-0 w-56 bg-[radial-gradient(circle_at_center,rgba(14,116,144,0.12),transparent_72%)]" />
                <div className="relative max-w-3xl">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
                        Постдипломный финансовый инструмент
                    </span>
                    <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
                        FinTechTerms
                    </h1>
                    <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                        Платформа развёрнута как постдипломный финансовый инструмент для системного освоения русскоязычной терминологии, академической классификации рынков и алгоритмического интервального повторения.
                    </p>
                    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        Вместо промо-подачи и потребительских механик интерфейс концентрируется на профессиональной навигации, точной таксономии и исследовательской дисциплине работы с терминологическим материалом.
                    </p>
                </div>
            </header>

            <section className="mt-8 grid gap-4 lg:grid-cols-3">
                {researchPillars.map(({ title, description, icon: Icon }) => (
                    <article
                        key={title}
                        className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                            <Icon className="h-6 w-6" />
                        </div>
                        <h2 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">
                            {title}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {description}
                        </p>
                    </article>
                ))}
            </section>

            <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="max-w-3xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Архитектурный контур
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        Технологическая система выстроена вокруг академической устойчивости, а не витринного маркетинга.
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        Архитектура объединяет Next.js 16, SSR-защиту сессий, централизованную базу Supabase и профессиональную интеграцию Telegram для уведомлений и распределённого доступа к материалам.
                    </p>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                    {architectureLayers.map(({ title, description, icon: Icon }) => (
                        <article
                            key={title}
                            className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/70"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                                        {title}
                                    </h3>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                        {description}
                                    </p>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-6">
                    <TelegramBanner variant="compact" />
                </div>
            </section>

            <section className="mt-8 grid gap-4 lg:grid-cols-[1.5fr,1fr]">
                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Методологическая логика
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        Интервальное повторение встроено как учебный протокол, а не как механика удержания.
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        Система SRS опирается на модели забывания Эббингауза и пересчитывает следующий обзор после каждого ответа. Это позволяет формировать академическую траекторию повторения для терминов, определений и рыночных категорий.
                    </p>
                    <Link
                        href="/methodology"
                        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-sky-200"
                    >
                        <BookOpen className="h-4 w-4" />
                        Открыть методологию платформы
                    </Link>
                </article>

                <article className="rounded-[1.75rem] border border-slate-200 bg-gradient-to-br from-slate-900 to-sky-900 p-7 text-white shadow-sm dark:border-slate-700">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                        Контакты
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                        Для исследовательских запросов и академических партнёрств
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-white/75">
                        Команда проекта рассматривает предложения по развитию таксономии, исследовательским сценариям и профессиональной интеграции платформы.
                    </p>
                    <a
                        href="mailto:fintechterms@mail.ru"
                        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-sky-100"
                    >
                        <Send className="h-4 w-4" />
                        fintechterms@mail.ru
                    </a>
                </article>
            </section>
        </div>
    );
}
