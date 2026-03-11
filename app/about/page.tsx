import { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
    title: 'О платформе FinTechTerms | Постдипломный финансовый инструмент',
    description: 'FinTechTerms — постдипломный финансовый инструмент для академического освоения терминологии, региональной таксономии рынков и интервального повторения.',
    alternates: {
        canonical: '/about',
    },
    openGraph: {
        title: 'О проекте FinTechTerms',
        description: 'Постдипломный финансовый инструмент для русскоязычной академической терминологии, SRS и исследовательской навигации по рынкам.',
    },
};

export default function AboutPage() {
    return <AboutClient />;
}
