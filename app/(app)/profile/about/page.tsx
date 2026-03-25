import type { Metadata } from 'next';
import ProfileLinkedPageClient from '@/app/profile/ProfileLinkedPageClient';

export const metadata: Metadata = {
    title: 'О проекте',
    description: 'Сводка о проекте FinTechTerms внутри приложения.',
    alternates: {
        canonical: '/profile/about',
    },
};

export default function ProfileAboutPage() {
    return <ProfileLinkedPageClient page="about" />;
}
