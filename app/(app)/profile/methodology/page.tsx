import type { Metadata } from 'next';
import ProfileLinkedPageClient from '@/app/profile/ProfileLinkedPageClient';

export const metadata: Metadata = {
    title: 'Методология',
    description: 'Методология FinTechTerms внутри приложения.',
    alternates: {
        canonical: '/profile/methodology',
    },
};

export default function ProfileMethodologyPage() {
    return <ProfileLinkedPageClient page="methodology" />;
}
