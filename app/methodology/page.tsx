import { Metadata } from 'next';
import MethodologyClient from './MethodologyClient';

export const metadata: Metadata = {
    title: 'Методология SRS | Как обучает FinTechTerms',
    description: 'Научный подход к запоминанию терминов с помощью кривой забывания Эббингауза и системы Лейтнера. Узнайте, как работает алгоритм FinTechTerms.',
    keywords: ['SRS', 'Spaced Repetition', 'Система Лейтнера', 'Кривая забывания', 'Техники памяти', 'Запоминание терминов'],
    alternates: {
        canonical: '/methodology',
    },
};

export default function MethodologyPage() {
    return <MethodologyClient />;
}
