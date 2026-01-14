import { Metadata } from 'next';
import SearchClient from './SearchClient';

export const metadata: Metadata = {
    title: 'Terim Ara | FinTechTerms Sözlüğü',
    description: 'Fintech, ekonomi ve bilişim terimlerinde arama yapın. Binlerce terim arasında hızlıca gezinin.',
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
