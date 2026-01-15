import { Metadata } from 'next';
import HomeClient from './HomeClient';
import { supabase } from '@/lib/supabase';
import { Term, Category } from '@/types';

export const metadata: Metadata = {
    title: 'FinTechTerms | Finans, Fintech ve Teknoloji Sözlüğü',
    description: 'En kapsamlı fintech, finans ve teknoloji terimleri sözlüğü. SRS sistemi ile terimleri kalıcı olarak öğrenin. Şimdi ücretsiz deneyin.',
    alternates: {
        canonical: '/',
        languages: {
            'tr-TR': '/',
            'en-US': '/',
            'ru-RU': '/',
        },
    },
};

export const revalidate = 3600; // Revalidate every hour

async function getRecentTerms(): Promise<Term[]> {
    try {
        const { data, error } = await supabase
            .from('terms')
            .select('*')
            //.order('created_at', { ascending: false }) // Assuming created_at exists, if not use id
            .limit(3);

        if (error || !data) {
            console.warn('Error fetching terms for SSR:', error);
            return [];
        }

        // Map DB result to Term interface by adding default SRS fields
        return data.map((t) => ({
            ...t,
            // Default SRS fields
            srs_level: 0,
            next_review_date: new Date().toISOString(),
            last_reviewed: null,
            difficulty_score: 0,
            retention_rate: 0,
            times_reviewed: 0,
            times_correct: 0,
            // Ensure category matches
            category: t.category as Category,
        }));
    } catch (e) {
        console.error('Unexpected error during SSR fetch:', e);
        return [];
    }
}

export default async function HomePage() {
    const terms = await getRecentTerms();

    return <HomeClient initialTerms={terms} />;
}
