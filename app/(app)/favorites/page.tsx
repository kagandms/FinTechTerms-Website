import { Metadata } from 'next';
import FavoritesClient from '@/app/favorites/FavoritesClient';

export const metadata: Metadata = {
    title: 'Избранные термины',
    description: 'Ваши сохранённые термины по экономике, финтеху и ИТ.',
    alternates: {
        canonical: '/favorites',
    },
};

export default function FavoritesPage() {
    return <FavoritesClient />;
}
