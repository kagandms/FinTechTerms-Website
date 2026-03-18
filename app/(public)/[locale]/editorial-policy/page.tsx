import { notFound } from 'next/navigation';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { buildLocalePath, isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

const pageCopy: Record<Language, {
    title: string;
    description: string;
    sections: Array<{ title: string; body: string }>;
}> = {
    en: {
        title: 'Editorial policy',
        description: 'How FinTechTerms governs source selection, review, updates, and YMYL trust signals.',
        sections: [
            {
                title: 'Source threshold',
                body: 'Priority term pages require at least three primary or institutionally strong sources. Preference goes to official documentation, regulation, standards bodies, and first-party educational material.',
            },
            {
                title: 'Review workflow',
                body: 'Every published term shows author ownership, review ownership, and a visible review date. Material may be revised when a regulation, standard, or product market practice changes.',
            },
            {
                title: 'YMYL handling',
                body: 'Financially sensitive pages are written as educational reference material, not as individualized advice. Definitions must be precise, scope-bounded, and source-backed.',
            },
        ],
    },
    ru: {
        title: 'Редакционная политика',
        description: 'Как FinTechTerms управляет выбором источников, ревью, обновлениями и YMYL trust-сигналами.',
        sections: [
            {
                title: 'Порог источников',
                body: 'Приоритетные терминологические страницы требуют как минимум трёх первичных или институционально сильных источников. Приоритет отдается официальной документации, регулированию, стандартам и first-party educational material.',
            },
            {
                title: 'Процесс ревью',
                body: 'Каждый опубликованный термин показывает автора, слой проверки и видимую дату ревью. Материал пересматривается при изменении регуляторики, стандартов или рыночной практики.',
            },
            {
                title: 'Работа с YMYL',
                body: 'Финансово чувствительные страницы пишутся как образовательный справочный материал, а не как персонализированная рекомендация. Определения должны быть точными, ограниченными по scope и подтверждёнными источниками.',
            },
        ],
    },
    tr: {
        title: 'Editoryal politika',
        description: 'FinTechTerms’in kaynak seçimi, inceleme, güncelleme ve YMYL güven sinyallerini nasıl yönettiği.',
        sections: [
            {
                title: 'Kaynak eşiği',
                body: 'Öncelikli terim sayfaları en az üç birincil veya kurumsal olarak güçlü kaynak gerektirir. Resmi dokümantasyon, düzenleme, standart kurumları ve first-party educational material tercih edilir.',
            },
            {
                title: 'İnceleme akışı',
                body: 'Yayımlanan her terim, yazar sahipliğini, inceleme sahipliğini ve görünür inceleme tarihini gösterir. Düzenleme, standart veya piyasa pratiği değiştiğinde içerik revize edilebilir.',
            },
            {
                title: 'YMYL yaklaşımı',
                body: 'Finansal açıdan hassas sayfalar kişiselleştirilmiş tavsiye değil, eğitsel referans materyali olarak yazılır. Tanımlar kesin, kapsamı belirli ve kaynakla desteklenmiş olmalıdır.',
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
        path: buildLocalePath(rawLocale, '/editorial-policy'),
    });
}

export default async function EditorialPolicyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;

    if (!isPublicLocale(rawLocale)) {
        notFound();
    }

    const copy = pageCopy[rawLocale];

    return (
        <div className="space-y-6">
            <section className="rounded-[2.5rem] border border-slate-200 bg-white px-6 py-10 shadow-sm md:px-10">
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{copy.title}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{copy.description}</p>
            </section>
            <section className="grid gap-4">
                {copy.sections.map((section) => (
                    <article key={section.title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-2xl font-bold text-slate-950">{section.title}</h2>
                        <p className="mt-4 text-sm leading-7 text-slate-600">{section.body}</p>
                    </article>
                ))}
            </section>
        </div>
    );
}
