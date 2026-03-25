'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    ArrowLeft,
    BarChart3,
    Blocks,
    Brain,
    FileText,
    Network,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';

type ProfileLinkedPageKind = 'about' | 'methodology';

interface ProfileLinkedPageClientProps {
    page: ProfileLinkedPageKind;
}

interface PageMetric {
    label: string;
    value: string;
}

interface PageSection {
    eyebrow: string;
    title: string;
    body: string;
}

interface PageCopy {
    back: string;
    title: string;
    subtitle: string;
    overview: string;
    metrics: PageMetric[];
    sections: PageSection[];
}

const copyByPage: Record<ProfileLinkedPageKind, Record<'tr' | 'en' | 'ru', PageCopy>> = {
    about: {
        tr: {
            back: 'Profile dön',
            title: 'Proje Hakkında',
            subtitle: 'FinTechTerms çok dilli sözlük, çalışma ve kamuya açık içerik katmanını tek üründe birleştirir.',
            overview: 'Genel bakış',
            metrics: [
                { label: 'Odak', value: 'Finans + fintek + teknoloji' },
                { label: 'Yapı', value: 'Sözlük, pratik ve profil akışı' },
                { label: 'Standart', value: 'Kaynaklı ve bakımı yapılabilir içerik' },
            ],
            sections: [
                {
                    eyebrow: 'Ürün modeli',
                    title: 'Sözlük ve çalışma altyapısı',
                    body: 'Platform, terim kataloğu ile pratik akışlarını aynı ürün içinde birleştirir; kullanıcı sadece tanımı değil, tekrar ve favori akışını da aynı yerde kullanır.',
                },
                {
                    eyebrow: 'Yayın modeli',
                    title: 'Kamuya açık bilgi katmanı',
                    body: 'Public sayfalar arama motorları ve kaynak görünürlüğü için ayrı korunur; uygulama içi ekranlar ise daha hızlı ve odaklı kullanım için profile bağlanır.',
                },
                {
                    eyebrow: 'Mühendislik modeli',
                    title: 'Tek kod tabanında iki deneyim',
                    body: 'App shell, kimlik doğrulama ve öğrenme akışlarını taşır; public shell, SEO ve kamusal proje sunumunu taşır. Bu ayrım tasarımsal tutarlılığı koruyarak bakımı kolaylaştırır.',
                },
            ],
        },
        en: {
            back: 'Back to Profile',
            title: 'About the Project',
            subtitle: 'FinTechTerms combines a multilingual glossary, study flow, and public-facing content layer in one product.',
            overview: 'Overview',
            metrics: [
                { label: 'Focus', value: 'Finance + fintech + technology' },
                { label: 'Structure', value: 'Glossary, practice, and profile flows' },
                { label: 'Standard', value: 'Source-backed maintainable content' },
            ],
            sections: [
                {
                    eyebrow: 'Product model',
                    title: 'Glossary and study infrastructure',
                    body: 'The platform combines the term catalog with practice flows so the user works with definitions, review, and favorites in one surface.',
                },
                {
                    eyebrow: 'Publishing model',
                    title: 'Public information layer',
                    body: 'Public pages stay separate for search visibility and source-backed presentation, while app-shell screens stay focused on faster profile-driven usage.',
                },
                {
                    eyebrow: 'Engineering model',
                    title: 'Two experiences in one codebase',
                    body: 'The app shell carries authentication and learning flows; the public shell carries SEO and public project presentation. The separation keeps the architecture maintainable.',
                },
            ],
        },
        ru: {
            back: 'Назад в профиль',
            title: 'О проекте',
            subtitle: 'FinTechTerms объединяет многоязычный глоссарий, учебный поток и публичный контентный слой в одном продукте.',
            overview: 'Обзор',
            metrics: [
                { label: 'Фокус', value: 'Финансы + финтех + технологии' },
                { label: 'Структура', value: 'Словарь, практика и профиль' },
                { label: 'Стандарт', value: 'Контент с источниками и поддержкой' },
            ],
            sections: [
                {
                    eyebrow: 'Продуктовая модель',
                    title: 'Глоссарий и учебная инфраструктура',
                    body: 'Платформа объединяет каталог терминов и практику так, чтобы пользователь работал с определениями, повторением и избранным в одном интерфейсе.',
                },
                {
                    eyebrow: 'Модель публикации',
                    title: 'Публичный информационный слой',
                    body: 'Публичные страницы сохраняются для поисковой видимости и source-backed представления, а app-shell экраны остаются сфокусированными на сценариях внутри профиля.',
                },
                {
                    eyebrow: 'Инженерная модель',
                    title: 'Два опыта в одной кодовой базе',
                    body: 'App shell несет авторизацию и учебные потоки; public shell несет SEO и публичное представление проекта. Такое разделение упрощает поддержку.',
                },
            ],
        },
    },
    methodology: {
        tr: {
            back: 'Profile dön',
            title: 'Metodoloji',
            subtitle: 'FinTechTerms içeriği yazım, inceleme ve dağıtım kararlarını sistemli bir editoryal akışla kurar.',
            overview: 'Yöntem özeti',
            metrics: [
                { label: 'Katman', value: 'Yazım, inceleme, dağıtım' },
                { label: 'Hedef', value: 'Tutarlı ve tekrar kullanılabilir içerik' },
                { label: 'Çıktı', value: 'App shell ile uyumlu bilgi blokları' },
            ],
            sections: [
                {
                    eyebrow: 'Yazım katmanı',
                    title: 'Terim yapısı',
                    body: 'Her terim tanım, açıklama, bağlam ve uygulama örneği ile katmanlı olarak yazılır. Bu sayede aynı veri search, card ve public sayfada tekrar kullanılabilir.',
                },
                {
                    eyebrow: 'İnceleme katmanı',
                    title: 'Kalite ve doğrulama',
                    body: 'Yayın öncesi içerik; isimlendirme, açıklama doğruluğu ve arayüzde kullanılan özet metinler açısından kontrol edilir. Böylesi tutarsız ekran metinlerini azaltır.',
                },
                {
                    eyebrow: 'Dağıtım katmanı',
                    title: 'Shell bazlı sunum',
                    body: 'Aynı içerik public shell ve app shell içinde farklı sunulur. Profile bağlı sayfalar analytics ile aynı yerleşim mantığını kullanır; public sayfalar ise SEO odaklı kalır.',
                },
            ],
        },
        en: {
            back: 'Back to Profile',
            title: 'Methodology',
            subtitle: 'FinTechTerms structures writing, review, and distribution decisions through a consistent editorial workflow.',
            overview: 'Method summary',
            metrics: [
                { label: 'Layers', value: 'Writing, review, distribution' },
                { label: 'Goal', value: 'Consistent reusable content' },
                { label: 'Output', value: 'App-shell-aligned information blocks' },
            ],
            sections: [
                {
                    eyebrow: 'Writing layer',
                    title: 'Term structure',
                    body: 'Each term is written as a layered record with definition, explanation, context, and applied example so the same data can power search, cards, and public pages.',
                },
                {
                    eyebrow: 'Review layer',
                    title: 'Quality and validation',
                    body: 'Before publishing, content is checked for naming quality, explanation accuracy, and the summary strings used across the interface. That reduces inconsistent screen copy.',
                },
                {
                    eyebrow: 'Distribution layer',
                    title: 'Shell-based presentation',
                    body: 'The same content is presented differently in the public shell and the app shell. Profile-linked pages use the same layout logic as analytics, while public pages remain SEO-oriented.',
                },
            ],
        },
        ru: {
            back: 'Назад в профиль',
            title: 'Методология',
            subtitle: 'FinTechTerms выстраивает решения по написанию, ревью и доставке контента через последовательный редакционный workflow.',
            overview: 'Кратко о методе',
            metrics: [
                { label: 'Слои', value: 'Написание, ревью, доставка' },
                { label: 'Цель', value: 'Последовательный переиспользуемый контент' },
                { label: 'Результат', value: 'Информационные блоки в стиле app shell' },
            ],
            sections: [
                {
                    eyebrow: 'Слой написания',
                    title: 'Структура термина',
                    body: 'Каждый термин оформляется как многослойная запись с определением, объяснением, контекстом и практическим примером, чтобы одни и те же данные работали в поиске, карточках и публичных страницах.',
                },
                {
                    eyebrow: 'Слой ревью',
                    title: 'Качество и проверка',
                    body: 'Перед публикацией контент проверяется на качество именования, точность объяснения и краткие строки интерфейса. Это уменьшает несогласованные тексты на экранах.',
                },
                {
                    eyebrow: 'Слой доставки',
                    title: 'Shell-ориентированная подача',
                    body: 'Один и тот же контент по-разному подается в public shell и app shell. Страницы из профиля используют тот же каркас, что и analytics, а публичные страницы остаются SEO-ориентированными.',
                },
            ],
        },
    },
};

const headerIconByPage = {
    about: FileText,
    methodology: Brain,
} as const;

const metricIcons = [Blocks, ShieldCheck, BarChart3] as const;
const sectionIcons = [Network, Sparkles, Brain] as const;

export default function ProfileLinkedPageClient({ page }: ProfileLinkedPageClientProps) {
    const { language } = useLanguage();
    const copy = copyByPage[page][language] ?? copyByPage[page].en;
    const HeaderIcon = headerIconByPage[page];

    return (
        <div className="page-content px-4 py-6">
            <Link
                href="/profile"
                className="mb-4 inline-flex items-center gap-2 text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-200 dark:hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                {copy.back}
            </Link>

            <header className="mb-6 text-center">
                <div className="mb-3 inline-flex items-center justify-center rounded-2xl bg-primary-100 p-3 dark:bg-primary-900/30">
                    <HeaderIcon className="h-8 w-8 text-primary-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{copy.title}</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-300">{copy.subtitle}</p>
            </header>

            <section className="mb-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-300">
                    {copy.overview}
                </h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {copy.metrics.map((metric, index) => {
                        const Icon = metricIcons[index] ?? Blocks;

                        return (
                            <article key={metric.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <Icon className="mb-2 h-5 w-5 text-primary-500" />
                                <p className="text-xs uppercase tracking-[0.16em] text-gray-400 dark:text-slate-300">
                                    {metric.label}
                                </p>
                                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    {metric.value}
                                </p>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="space-y-3">
                {copy.sections.map((section, index) => {
                    const Icon = sectionIcons[index] ?? Network;

                    return (
                        <article key={section.title} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="max-w-3xl">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-slate-300">
                                        {section.eyebrow}
                                    </p>
                                    <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
                                        {section.title}
                                    </h2>
                                    <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
                                        {section.body}
                                    </p>
                                </div>
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                                    <Icon className="h-5 w-5" />
                                </div>
                            </div>
                        </article>
                    );
                })}
            </section>
        </div>
    );
}
