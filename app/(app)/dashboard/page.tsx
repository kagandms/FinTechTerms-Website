import HomeClient from '@/app/HomeClient';
import { listHomepageTerms } from '@/lib/public-term-catalog';
import { getScriptNonce } from '@/lib/script-nonce';
import type { Term } from '@/types';

export const revalidate = 3600; // Revalidate every hour

async function getRecentTerms(): Promise<Term[]> {
    return await listHomepageTerms(3);
}

export default async function HomePage() {
    const terms = await getRecentTerms();
    const nonce = await getScriptNonce();

    return <HomeClient initialTerms={terms} nonce={nonce} />;
}
