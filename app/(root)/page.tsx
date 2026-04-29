import nextDynamic from 'next/dynamic';
import { getLearningStats } from '@/app/actions/getLearningStats';
import { listHomepageTerms } from '@/lib/public-term-catalog';
import type { Term } from '@/types';

const DynamicHomeClient = nextDynamic(() => import('@/app/HomeClient'));

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

    return <DynamicHomeClient initialTerms={terms} learningStats={learningStats} />;
}
