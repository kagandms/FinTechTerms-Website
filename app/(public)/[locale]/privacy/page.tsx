import { notFound } from 'next/navigation';
import PublicSiblingLocaleLinks from '@/components/public-sibling-locale-links';
import { serializeJsonLd } from '@/lib/json-ld';
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd } from '@/lib/public-schema';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildAbsoluteUrl, buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const pageCopy: Record<Language, { title: string; description: string; sections: readonly { title: string; body: string }[] }> = {
    en: {
        title: 'Privacy Policy',
        description: 'How FinTechTerms handles public glossary usage data, account data, analytics, and contact requests.',
        sections: [
            {
                title: 'Data we process',
                body: 'FinTechTerms publishes public glossary pages and provides optional learning features. Account, progress, favorite, analytics, and contact data are processed only when a user chooses the relevant feature or sends a request.',
            },
            {
                title: 'How data is used',
                body: 'Data is used to operate the glossary, preserve study progress, improve reliability, respond to corrections, and maintain abuse protection. Public SEO pages do not require an account.',
            },
            {
                title: 'Contact and corrections',
                body: 'Privacy questions and correction requests can be sent through the contact channel listed on the public contact page.',
            },
        ],
    },
    ru: {
        title: 'Политика конфиденциальности',
        description: 'Как FinTechTerms обрабатывает данные публичного глоссария, аккаунта, аналитики и обращений.',
        sections: [
            {
                title: 'Какие данные обрабатываются',
                body: 'FinTechTerms публикует открытые страницы глоссария и предоставляет необязательные учебные функции. Данные аккаунта, прогресса, избранного, аналитики и обращений обрабатываются только при использовании соответствующей функции или отправке запроса.',
            },
            {
                title: 'Как используются данные',
                body: 'Данные используются для работы глоссария, сохранения учебного прогресса, повышения надёжности, ответа на исправления и защиты от злоупотреблений. Публичные SEO-страницы не требуют аккаунта.',
            },
            {
                title: 'Контакты и исправления',
                body: 'Вопросы по конфиденциальности и запросы на исправления можно отправлять через канал связи, указанный на публичной странице контактов.',
            },
        ],
    },
    tr: {
        title: 'Gizlilik Politikası',
        description: 'FinTechTerms’in kamusal sözlük kullanımı, hesap verisi, analitik ve iletişim taleplerini nasıl işlediği.',
        sections: [
            {
                title: 'İşlenen veriler',
                body: 'FinTechTerms herkese açık sözlük sayfaları yayınlar ve isteğe bağlı öğrenme özellikleri sunar. Hesap, ilerleme, favori, analitik ve iletişim verileri yalnızca kullanıcı ilgili özelliği seçtiğinde veya talep gönderdiğinde işlenir.',
            },
            {
                title: 'Verinin kullanım amacı',
                body: 'Veri; sözlüğü çalıştırmak, çalışma ilerlemesini korumak, güvenilirliği iyileştirmek, düzeltme taleplerine yanıt vermek ve kötüye kullanımı önlemek için kullanılır. Public SEO sayfaları hesap gerektirmez.',
            },
            {
                title: 'İletişim ve düzeltmeler',
                body: 'Gizlilik soruları ve düzeltme talepleri public iletişim sayfasındaki kanal üzerinden gönderilebilir.',
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
        path: buildLocalePath(rawLocale, '/privacy'),
    });
}

export default async function PrivacyPage({
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
    const path = buildLocalePath(locale, '/privacy');

    return (
        <div className="space-y-8">
            <PublicSiblingLocaleLinks currentLocale={locale} suffix="/privacy" />
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
