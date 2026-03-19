import HomeClient from '@/app/HomeClient';
import { listHomepageTerms } from '@/lib/public-term-catalog';
import type { Term } from '@/types';

export const revalidate = 3600;

async function getRecentTerms(): Promise<Term[]> {
    return await listHomepageTerms(3);
}

export default async function HomePage() {
    const terms = await getRecentTerms();

    return <HomeClient initialTerms={terms} />;
}
