import { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
    title: 'О проекте FinTechTerms | Миссия и видение',
    description: 'FinTechTerms — академический проект для изучения терминов по финансам и технологиям с помощью интервальных повторений. Узнайте о нашей миссии и методологии.',
    alternates: {
        canonical: '/about',
    },
    openGraph: {
        title: 'О проекте FinTechTerms',
        description: 'Подробности о трёхъязычном интеллектуальном словаре, созданном для развития финансовой грамотности.',
    },
};

export default function AboutPage() {
    return <AboutClient />;
}
