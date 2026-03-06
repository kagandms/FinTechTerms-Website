import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SRSProvider } from '@/contexts/SRSContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import BottomNav from '@/components/BottomNav';
import ConsentModal from '@/components/ConsentModal';
import SessionTracker from '@/components/SessionTracker';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import BadgeRealtimeNotifier from '@/components/profile/BadgeRealtimeNotifier';

import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-jetbrains-mono',
    display: 'swap',
});

type SeoLanguage = 'ru' | 'tr' | 'en';

const siteUrl = 'https://fintechterms.com';
const primaryLanguage: SeoLanguage = 'ru';

const seoMeta: Record<SeoLanguage, {
    title: string;
    description: string;
    ogLocale: 'ru_RU' | 'tr_TR' | 'en_US';
    alternateLocale: ('ru_RU' | 'tr_TR' | 'en_US')[];
}> = {
    ru: {
        title: 'FinTechTerms | Словарь финансовых, финтех и IT-терминов',
        description: 'Изучайте финансовые, финтех и IT-термины на русском, турецком и английском. Умный словарь с SRS-повторением и практикой.',
        ogLocale: 'ru_RU',
        alternateLocale: ['tr_TR', 'en_US'],
    },
    tr: {
        title: 'FinTechTerms | Finans, Fintech ve Teknoloji Sözlüğü',
        description: 'Finans, fintech ve teknoloji terimlerini Türkçe, Rusça ve İngilizce öğrenin. SRS destekli akıllı sözlük ve pratik akışı.',
        ogLocale: 'tr_TR',
        alternateLocale: ['ru_RU', 'en_US'],
    },
    en: {
        title: 'FinTechTerms | Finance, Fintech, and Technology Dictionary',
        description: 'Learn finance, fintech, and technology terms in English, Russian, and Turkish with smart SRS-based review and practice.',
        ogLocale: 'en_US',
        alternateLocale: ['ru_RU', 'tr_TR'],
    },
};
const primarySeo = seoMeta[primaryLanguage];

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
        default: primarySeo.title,
        template: '%s | FinTechTerms',
    },
    description: primarySeo.description,
    alternates: {
        canonical: '/',
        languages: {
            'x-default': '/',
            'ru-RU': '/',
            'tr-TR': '/?lang=tr',
            'en-US': '/?lang=en',
        },
    },
    icons: {
        icon: [
            { url: '/home-logo.png', type: 'image/png', sizes: '512x512' },
        ],
        shortcut: '/home-logo.png',
        apple: '/home-logo.png',
    },
    manifest: '/manifest.json',
    openGraph: {
        title: primarySeo.title,
        description: primarySeo.description,
        url: siteUrl,
        siteName: 'FinTechTerms',
        locale: primarySeo.ogLocale,
        alternateLocale: primarySeo.alternateLocale,
        type: 'website',
        images: [
            {
                url: '/home-logo.png',
                width: 512,
                height: 512,
                alt: 'FinTechTerms Logo',
            },
        ],
    },
    twitter: {
        card: 'summary',
        title: primarySeo.title,
        description: primarySeo.description,
        images: ['/home-logo.png'],
        creator: '@fintechterms',
        site: '@fintechterms',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    themeColor: '#0e3b5e',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang={primaryLanguage} suppressHydrationWarning>
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'WebApplication',
                            name: 'FinTechTerms',
                            description: primarySeo.description,
                            url: siteUrl,
                            logo: `${siteUrl}/home-logo.png`,
                            applicationCategory: 'EducationalApplication',
                            operatingSystem: 'Web',
                            offers: {
                                '@type': 'Offer',
                                price: '0',
                                priceCurrency: 'USD',
                            },
                            inLanguage: ['ru', 'en', 'tr'],
                            author: {
                                '@type': 'Organization',
                                name: 'FinTechTerms',
                            },
                        }),
                    }}
                />
            </head>
            <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
                <ThemeProvider>
                    <AuthProvider>
                        <LanguageProvider>
                            <SRSProvider>
                                <ToastProvider>
                                    <div className="page-wrapper">
                                        <main className="w-full max-w-lg md:max-w-5xl mx-auto transition-all duration-300">
                                            {children}
                                        </main>
                                        <BottomNav />
                                        <ConsentModal />
                                        <SessionTracker />
                                        <BadgeRealtimeNotifier />
                                    </div>
                                </ToastProvider>
                            </SRSProvider>
                        </LanguageProvider>
                    </AuthProvider>
                </ThemeProvider>
                <GoogleAnalytics />
            </body>
        </html>
    );
}
