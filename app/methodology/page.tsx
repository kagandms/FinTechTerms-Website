import { Metadata } from 'next';
import MethodologyClient from './MethodologyClient';

export const metadata: Metadata = {
    title: 'SRS Metodolojisi | FinTechTerms Nasıl Öğretir?',
    description: 'Ebbinghaus Unutma Eğrisi ve Leitner Sistemi ile bilimsel kelime ezberleme yöntemi. FinTechTerms\'in akıllı SRS algoritması hakkında bilgi edinin.',
    keywords: ['SRS', 'Spaced Repetition', 'Aralıklı Tekrar', 'Leitner Sistemi', 'Unutma Eğrisi', 'Hafıza Teknikleri', 'Kelime Ezberleme'],
    alternates: {
        canonical: '/methodology',
    },
};

export default function MethodologyPage() {
    return <MethodologyClient />;
}
