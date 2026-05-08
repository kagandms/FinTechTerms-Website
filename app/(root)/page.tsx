import HomeClient from '@/app/HomeClient';
import { getLearningStats } from '@/app/actions/getLearningStats';
import { listHomepageTerms } from '@/lib/public-term-catalog';
import type { Term } from '@/types';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

async function getRecentTerms(): Promise<Term[]> {
    return await listHomepageTerms(3);
}

export default async function HomePage() {
    const [terms, learningStats] = await Promise.all([
        getRecentTerms(),
        getLearningStats(),
    ]);

    return <HomeClient initialTerms={terms} learningStats={learningStats} />;
}
