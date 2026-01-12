import { Metadata } from 'next';
import { getTermById, fetchTermsFromSupabase } from '@/lib/supabaseStorage';
import SmartCard from '@/components/SmartCard';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type Props = {
    params: Promise<{ id: string }>;
};

// Generate metadata for each term
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const term = await getTermById(id);

    if (!term) {
        return {
            title: 'Term Not Found',
        };
    }

    return {
        title: `${term.term_en} - What is it? | FinTechTerms`,
        description: term.definition_en,
        openGraph: {
            title: `${term.term_en} (${term.term_tr}) | FinTechTerms`,
            description: term.definition_en,
            type: 'article',
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

    // Cast partial term to full term since we know db returns full content fields
    // and we'll use default SRS values if missing (handled by SmartCard/Context or we mock it here)
    // Actually SmartCard expects a full Term. We need to fill in defaults for the visual component.
    const fullTerm = {
        ...termData,
        // Provide defaults for SRS fields if they are missing from the Partial<Term>
        srs_level: termData.srs_level ?? 0,
        next_review_date: termData.next_review_date ?? new Date().toISOString(),
        last_reviewed: termData.last_reviewed ?? null,
        difficulty_score: termData.difficulty_score ?? 0,
        retention_rate: termData.retention_rate ?? 0,
        times_reviewed: termData.times_reviewed ?? 0,
        times_correct: termData.times_correct ?? 0,
    } as any; // Cast to any or Term to satisfy TS if fields match

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <Link
                    href="/"
                    className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dictionary
                </Link>

                <h1 className="sr-only">{fullTerm.term_en} Definition</h1>

                <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
                    <SmartCard term={fullTerm} showFullDetails={true} />
                </div>

                <div className="mt-8 text-center text-sm text-gray-400">
                    <p>FinTechTerms - The Trilingual Financial Dictionary</p>
                </div>
            </div>
        </div>
    );
}
