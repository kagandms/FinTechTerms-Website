import { Metadata } from 'next';
import SearchClient from '@/app/search/SearchClient';

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

export default function SearchPage() {
    return <SearchClient />;
}
