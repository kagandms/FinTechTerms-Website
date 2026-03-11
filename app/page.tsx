import HomeClient from './HomeClient';
import { fetchTermsFromSupabase } from '@/lib/supabaseStorage';
import { Term, Category } from '@/types';
import { createSafeTerm } from '@/utils/termUtils';

export const revalidate = 3600; // Revalidate every hour

async function getRecentTerms(): Promise<Term[]> {
    try {
        const data = await fetchTermsFromSupabase();
        const recentTerms = data.slice(0, 3);

        if (recentTerms.length === 0) {
            console.warn('Error fetching terms for SSR: no terms returned');
            return [];
        }

        // Map DB result to Term interface by adding default SRS fields
        return recentTerms.map((t) => createSafeTerm({
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
