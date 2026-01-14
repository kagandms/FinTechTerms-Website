import { Metadata } from 'next';
import QuizClient from './QuizClient';

export const metadata: Metadata = {
    title: 'Finansal Kelime Testi | FinTechTerms Quiz',
    description: 'Fintech, ekonomi ve bilişim bilginizi test edin. SRS tabanlı quiz ile öğrendiklerinizi pekiştirin.',
    alternates: {
        canonical: '/quiz',
    },
};

export default function QuizPage() {
    return <QuizClient />;
}
