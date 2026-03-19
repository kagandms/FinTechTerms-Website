import { Metadata } from 'next';
import SearchClient from '@/app/search/SearchClient';
import { getScriptNonce } from '@/lib/script-nonce';

export const metadata: Metadata = {
    title: 'Поиск терминов',
    description: 'Ищите термины по финансам, финтеху и ИТ. Быстро находите нужные понятия в многоязычном словаре.',
    robots: {
        index: false,
        follow: false,
    },
    alternates: {
        canonical: '/search',
    },
};

export default async function SearchPage() {
    const nonce = await getScriptNonce();
    return <SearchClient nonce={nonce} />;
}
