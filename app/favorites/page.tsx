import { Metadata } from 'next';
import FavoritesClient from './FavoritesClient';

export const metadata: Metadata = {
    title: 'Избранные термины | FinTechTerms',
    description: 'Ваши сохранённые термины по экономике, финтеху и ИТ.',
    alternates: {
        canonical: '/favorites',
    },
};

export default function FavoritesPage() {
    return <FavoritesClient />;
}
