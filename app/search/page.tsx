import { Metadata } from 'next';
import SearchClient from './SearchClient';

export const metadata: Metadata = {
    title: 'Поиск терминов | FinTechTerms',
    description: 'Ищите термины по финансам, финтеху и ИТ. Быстро находите нужные понятия в многоязычном словаре.',
    robots: {
        index: true,
        follow: true,
    },
    alternates: {
        canonical: '/search',
    },
};

export default function SearchPage() {
    return <SearchClient />;
}
