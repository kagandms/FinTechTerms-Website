import { Metadata } from 'next';
import FavoritesClient from './FavoritesClient';

export const metadata: Metadata = {
    title: 'Favorilerim | FinTechTerms',
    description: 'Favori teknoloji ve finans terimleriniz.',
    alternates: {
        canonical: '/favorites',
    },
};

export default function FavoritesPage() {
    return <FavoritesClient />;
}
