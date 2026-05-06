import { notFound } from 'next/navigation';
import PublicSiblingLocaleLinks from '@/components/public-sibling-locale-links';
import { serializeJsonLd } from '@/lib/json-ld';
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd } from '@/lib/public-schema';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const pageCopy: Record<Language, { title: string; description: string; sections: readonly { title: string; body: string }[] }> = {
    en: {
        title: 'Terms of Service',
        description: 'Usage terms for the FinTechTerms public glossary, educational content, and optional learning features.',
        sections: [
            {
                title: 'Educational scope',
                body: 'FinTechTerms content is educational. It does not provide investment, legal, tax, regulatory, or trading advice.',
            },
            {
                title: 'Acceptable use',
                body: 'Users may browse and study the glossary. Automated abuse, scraping that degrades service, account misuse, or attempts to bypass security controls are not permitted.',
            },
            {
                title: 'Content corrections',
                body: 'Financial and technology terminology changes over time. Corrections are handled through the public corrections and contact workflow.',
            },
        ],
    },
    ru: {
        title: 'Условия использования',
        description: 'Правила использования публичного глоссария FinTechTerms, образовательного контента и дополнительных учебных функций.',
        sections: [
            {
                title: 'Образовательный характер',
                body: 'Контент FinTechTerms является образовательным. Он не является инвестиционной, юридической, налоговой, регуляторной или торговой рекомендацией.',
            },
            {
                title: 'Допустимое использование',
                body: 'Пользователи могут читать и изучать глоссарий. Запрещены злоупотребления автоматизацией, scraping, ухудшающий работу сервиса, misuse аккаунта и обход защитных контролей.',
            },
            {
                title: 'Исправления контента',
                body: 'Финансовая и технологическая терминология меняется со временем. Исправления обрабатываются через публичный workflow исправлений и контактов.',
            },
        ],
    },
    tr: {
        title: 'Kullanım Şartları',
        description: 'FinTechTerms public sözlüğü, eğitsel içerikleri ve isteğe bağlı öğrenme özellikleri için kullanım şartları.',
        sections: [
            {
                title: 'Eğitsel kapsam',
                body: 'FinTechTerms içeriği eğitseldir. Yatırım, hukuk, vergi, regülasyon veya alım satım tavsiyesi değildir.',
            },
            {
                title: 'Kabul edilebilir kullanım',
                body: 'Kullanıcılar sözlüğü gezebilir ve çalışabilir. Servisi bozan otomasyon, kötüye kullanım amaçlı scraping, hesap kötüye kullanımı veya güvenlik kontrollerini aşma girişimleri yasaktır.',
            },
            {
                title: 'İçerik düzeltmeleri',
                body: 'Finansal ve teknolojik terminoloji zamanla değişir. Düzeltmeler public düzeltme ve iletişim akışı üzerinden ele alınır.',
            },
        ],
    },
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;

    if (!isPublicLocale(rawLocale)) {
        return {};
    }

    const copy = pageCopy[rawLocale];

    return buildSeoMetadata({
        locale: rawLocale,
        title: copy.title,
        description: copy.description,
        path: buildLocalePath(rawLocale, '/terms'),
    });
}

export default async function TermsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const locale = rawLocale;
    const copy = pageCopy[locale];
    const path = buildLocalePath(locale, '/terms');

    return (
        <div className="space-y-8">
            <PublicSiblingLocaleLinks currentLocale={locale} suffix="/terms" />
            <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-6 shadow-sm md:rounded-[2.5rem] md:px-10 md:py-10">
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{copy.title}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{copy.description}</p>
            </section>
            <section className="grid gap-4 md:grid-cols-3">
                {copy.sections.map((section) => (
                    <article key={section.title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-2xl font-bold text-slate-950">{section.title}</h2>
                        <p className="mt-4 text-base leading-8 text-slate-600">{section.body}</p>
                    </article>
                ))}
            </section>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: serializeJsonLd([
                        {
                            '@context': 'https://schema.org',
                            '@type': 'WebPage',
                            name: copy.title,
                            description: copy.description,
                            url: buildAbsoluteUrl(path),
                            inLanguage: locale,
                            publisher: buildOrganizationJsonLd(locale),
                        },
                        buildBreadcrumbJsonLd(locale, [{ name: copy.title, path }]),
                    ]),
                }}
            />
        </div>
    );
}
