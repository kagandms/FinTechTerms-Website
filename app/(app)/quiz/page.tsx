import { Metadata } from 'next';
import QuizClient from '@/app/quiz/QuizClient';

export const metadata: Metadata = {
    title: 'Практика терминов',
    description: 'Проверяйте знания по финансам, финтеху и ИТ с помощью практики на основе интервальных повторений.',
    alternates: {
        canonical: '/quiz',
    },
};

export default function QuizPage() {
    return <QuizClient />;
}
