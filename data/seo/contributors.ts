import type { Contributor } from '@/types';

export const seoContributors: readonly Contributor[] = [
    {
        id: 'kagan-samet-durmus',
        slug: 'kagan-samet-durmus',
        updated_at: '2026-03-15T00:00:00.000Z',
        kind: 'person',
        role: 'author',
        name: 'Kağan Samet Durmuş',
        title: {
            en: 'Founder and multilingual fintech glossary editor',
            ru: 'Основатель и редактор многоязычного финтех-глоссария',
            tr: 'Kurucu ve çok dilli fintek sözlüğü editörü',
        },
        bio: {
            en: 'Builds multilingual fintech learning systems at the intersection of MIS, economics, market structure, and technical product strategy.',
            ru: 'Развивает многоязычные финтех-системы обучения на пересечении MIS, экономики, рыночной микроструктуры и продуктовой стратегии.',
            tr: 'MIS, ekonomi, piyasa mikro yapısı ve teknik ürün stratejisinin kesişiminde çok dilli fintek öğrenme sistemleri geliştirir.',
        },
        disclosure: {
            en: 'Writes educational glossary content and product methodology for FinTechTerms.',
            ru: 'Готовит образовательный словарный контент и продуктовую методологию для FinTechTerms.',
            tr: 'FinTechTerms için eğitsel sözlük içeriği ve ürün metodolojisi hazırlar.',
        },
        languages: ['tr', 'en', 'ru'],
        expertise: ['FinTech', 'Payments', 'Market structure', 'Technical SEO', 'Multilingual education'],
        credential: {
            en: 'Management Information Systems and Economics undergraduate editor focused on fintech terminology, market structure, and multilingual product research.',
            ru: 'Редактор с академическим фокусом на MIS и экономику, финтех-терминологию, рыночную микроструктуру и многоязычные продуктовые исследования.',
            tr: 'MIS ve ekonomi odağıyla fintek terminolojisi, piyasa mikro yapısı ve çok dilli ürün araştırması üzerinde çalışan editör.',
        },
        affiliation: {
            en: 'FinTechTerms editorial and product research',
            ru: 'Редакционные и продуктовые исследования FinTechTerms',
            tr: 'FinTechTerms editoryal ve ürün araştırması',
        },
        affiliationPath: '/about',
        organization: 'FinTechTerms',
        email: 'fintechterms@mail.ru',
    },
    {
        id: 'fintechterms-editorial-review',
        slug: 'fintechterms-editorial-review',
        updated_at: '2026-03-15T00:00:00.000Z',
        kind: 'organization',
        role: 'reviewer',
        name: 'FinTechTerms Editorial Review',
        title: {
            en: 'Editorial and source review layer',
            ru: 'Редакционный и источниковый уровень проверки',
            tr: 'Editoryal ve kaynak inceleme katmanı',
        },
        bio: {
            en: 'Reviews glossary entries for source quality, definitional clarity, and YMYL trust signals before publication.',
            ru: 'Проверяет словарные материалы на качество источников, точность определений и YMYL-сигналы доверия перед публикацией.',
            tr: 'Sözlük maddelerini yayın öncesinde kaynak kalitesi, tanım netliği ve YMYL güven sinyalleri açısından inceler.',
        },
        disclosure: {
            en: 'Focuses on factual consistency, source hygiene, and editorial corrections.',
            ru: 'Фокусируется на фактической согласованности, гигиене источников и редакционных исправлениях.',
            tr: 'Olgusal tutarlılık, kaynak hijyeni ve editoryal düzeltmelere odaklanır.',
        },
        languages: ['tr', 'en', 'ru'],
        expertise: ['Editorial review', 'Source validation', 'YMYL quality control'],
        sameAs: ['https://t.me/FinTechTermsBot'],
        credential: {
            en: 'Source-review workflow covering primary documentation, regulatory material, research references, and correction records.',
            ru: 'Процесс проверки источников: первичная документация, регуляторные материалы, исследовательские ссылки и журнал исправлений.',
            tr: 'Birincil dokümantasyon, regülasyon metinleri, araştırma referansları ve düzeltme kayıtlarını kapsayan kaynak inceleme iş akışı.',
        },
        affiliation: {
            en: 'FinTechTerms editorial review layer',
            ru: 'Редакционный проверочный уровень FinTechTerms',
            tr: 'FinTechTerms editoryal inceleme katmanı',
        },
        affiliationPath: '/editorial-policy',
        organization: 'FinTechTerms',
        email: 'fintechterms@mail.ru',
    },
];
