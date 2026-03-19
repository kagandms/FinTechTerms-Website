import { Metadata } from 'next';
import QuizClient from '@/app/quiz/QuizClient';
import { getScriptNonce } from '@/lib/script-nonce';

export const metadata: Metadata = {
    title: 'Практика терминов',
    description: 'Проверяйте знания по финансам, финтеху и ИТ с помощью практики на основе интервальных повторений.',
    alternates: {
        canonical: '/quiz',
    },
};

export default async function QuizPage() {
    const nonce = await getScriptNonce();
    return <QuizClient nonce={nonce} />;
}
