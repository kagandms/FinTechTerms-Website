import { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
    title: 'FinTechTerms | Finans, Fintech ve Teknoloji Sözlüğü',
    description: 'En kapsamlı fintech, finans ve teknoloji terimleri sözlüğü. SRS sistemi ile terimleri kalıcı olarak öğrenin. Şimdi ücretsiz deneyin.',
    alternates: {
        canonical: '/',
        languages: {
            'tr-TR': '/',
            'en-US': '/',
            'ru-RU': '/',
        },
    },
};

export default function HomePage() {
    return <HomeClient />;
}
