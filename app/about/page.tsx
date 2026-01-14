import { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
    title: 'Hakkında - FinTechTerms Projesi | Misyonumuz ve Vizyonumuz',
    description: 'FinTechTerms, SRS (Aralıklı Tekrar Sistemi) kullanarak finans ve teknoloji terimlerini öğreten akademik bir projedir. Amacımız ve metodolojimiz hakkında bilgi alın.',
    alternates: {
        canonical: '/about',
    },
    openGraph: {
        title: 'Hakkında - FinTechTerms',
        description: 'Finansal okuryazarlığı artırmak için geliştirdiğimiz üç dilli akıllı sözlük projemiz hakkında detaylar.',
    },
};

export default function AboutPage() {
    return <AboutClient />;
}
