import { Metadata } from 'next';
import { getTermById, fetchTermsFromSupabase } from '@/lib/supabaseStorage';
import { createSafeTerm } from '@/utils/termUtils';
import SmartCard from '@/components/SmartCard';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Term, TermContextTagValue } from '@/types';

type Props = {
    params: Promise<{ id: string }>;
};

const extractContextKeywords = (term: Partial<Term>): string[] => {
    const contextTags = term.context_tags ?? {};

    return Object.values(contextTags).flatMap((value: TermContextTagValue | undefined) => {
        if (Array.isArray(value)) {
            return value.map((item) => String(item).trim()).filter(Boolean);
        }

        if (value === undefined || value === null) {
            return [];
        }

        const stringValue = String(value).trim();
        return stringValue ? [stringValue] : [];
    });
};

// Generate metadata for each term
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const term = await getTermById(id);

    if (!term) {
        return {
            title: 'Термин не найден',
        };
    }

    const primaryTerm = term.term_ru || term.term_en || 'Термин';
    const secondaryTerm = term.term_en || term.term_tr || '';
    const descriptionSource = term.definition_ru || term.definition_en || term.definition_tr || '';
    const title = secondaryTerm
        ? `${primaryTerm} (${secondaryTerm}) | FinTechTerms`
        : `${primaryTerm} | FinTechTerms`;
    const description = `${primaryTerm}: ${descriptionSource.slice(0, 140)}${descriptionSource.length > 140 ? '…' : ''}`;
    const taxonomyKeywords = extractContextKeywords(term);

    // Filter out undefined tags
    const tags = [
        term.category,
        term.regional_market,
        'FinTech',
        'Dictionary',
        ...taxonomyKeywords,
    ].filter((tag): tag is string => !!tag);

    return {
        title: title,
        description: description,
        keywords: [
            term.term_en || '', term.term_tr || '', term.term_ru || '',
            `${term.term_ru || ''} что это`,
            `${term.term_en || ''} meaning`,
            'финансовые термины', 'термины финтеха', 'SRS словарь',
            ...tags,
        ].filter(Boolean),
        alternates: {
            canonical: `/term/${id}`,
        },
        openGraph: {
            title: title,
            description: description,
            type: 'article',
            publishedTime: (term as any).created_at || new Date().toISOString(),
            tags: tags,
            images: [
                {
                    url: '/og-image.png',
                    width: 1200,
                    height: 630,
                    alt: `${primaryTerm} | FinTechTerms`,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: title,
            description: description,
            images: ['/og-image.png'],
        },
    };
}

// Generate static params for all known terms (for faster loading)
export async function generateStaticParams() {
    const terms = await fetchTermsFromSupabase();
    return terms.map((term) => ({
        id: term.id,
    }));
}

export default async function TermPage({ params }: Props) {
    const { id } = await params;
    const termData = await getTermById(id);

    if (!termData) {
        notFound();
    }

    // Use the safe factory function to ensure all fields are present
    // This replaces the dangerous "as any" cast
    const fullTerm = createSafeTerm(termData);

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <Link
                    href="/"
                    className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Назад к словарю
                </Link>

                <h1 className="sr-only">{fullTerm.term_ru || fullTerm.term_en} Определение</h1>

                <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
                    <SmartCard term={fullTerm} showFullDetails={true} />
                </div>

                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'DefinedTerm',
                            name: fullTerm.term_ru || fullTerm.term_en,
                            alternateName: [fullTerm.term_tr, fullTerm.term_ru],
                            description: fullTerm.definition_ru || fullTerm.definition_en,
                            inDefinedTermSet: {
                                '@type': 'DefinedTermSet',
                                name: 'Словарь FinTechTerms',
                                url: 'https://fintechterms.com'
                            },
                            termCode: fullTerm.id,
                            keywords: Array.from(new Set([
                                fullTerm.category,
                                fullTerm.regional_market,
                                ...extractContextKeywords(fullTerm),
                            ])).join(', ')
                        }),
                    }}
                />

                <div className="mt-8 text-center text-sm text-gray-400">
                    <p>FinTechTerms — трёхъязычный словарь экономики и технологий</p>
                </div>
            </div>
        </div>
    );
}
