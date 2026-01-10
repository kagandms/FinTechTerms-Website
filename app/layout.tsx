import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SRSProvider } from '@/contexts/SRSContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import BottomNav from '@/components/BottomNav';

const siteUrl = 'https://fintechterms.vercel.app';

export const metadata: Metadata = {
    // Basic Meta
    title: {
        default: 'FinTechTerms | TR-EN-RU Ekonomi ve Bilişim Sözlüğü',
        template: '%s | FinTechTerms',
    },
    description: 'Türkçe, İngilizce ve Rusça ekonomi, fintek ve bilişim terimlerini öğrenmek için SRS tabanlı akıllı sözlük uygulaması. 100+ terim, flashcard sistemi.',
    keywords: ['fintech', 'ekonomi', 'bilişim', 'sözlük', 'türkçe', 'ingilizce', 'rusça', 'SRS', 'flashcard', 'dictionary', 'финтех', 'словарь', 'экономика'],
    authors: [{ name: 'FinTechTerms', url: siteUrl }],
    creator: 'FinTechTerms',
    publisher: 'FinTechTerms',

    // Canonical & Alternates (hreflang)
    metadataBase: new URL(siteUrl),
    alternates: {
        canonical: '/',
        languages: {
            'tr-TR': '/',
            'en-US': '/',
            'ru-RU': '/',
        },
    },

    // Robots
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },

    // Open Graph
    openGraph: {
        title: 'FinTechTerms | TR-EN-RU Ekonomi ve Bilişim Sözlüğü',
        description: 'Türkçe, İngilizce ve Rusça ekonomi, fintek ve bilişim terimlerini öğrenmek için SRS tabanlı akıllı sözlük uygulaması.',
        url: siteUrl,
        siteName: 'FinTechTerms',
        locale: 'tr_TR',
        alternateLocale: ['en_US', 'ru_RU'],
        type: 'website',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'FinTechTerms - TR/EN/RU Trilingual Dictionary',
            },
        ],
    },

    // Twitter
    twitter: {
        card: 'summary_large_image',
        title: 'FinTechTerms | TR-EN-RU Ekonomi ve Bilişim Sözlüğü',
        description: 'Trilingual ekonomi ve bilişim sözlüğü - SRS tabanlı akıllı öğrenme. 100+ terim.',
        images: ['/og-image.png'],
        creator: '@fintechterms',
    },

    // Category & Classification
    category: 'education',

    // PWA
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'FinTechTerms',
    },

    // Verification (placeholder - replace with actual codes)
    // verification: {
    //     google: 'your-google-verification-code',
    //     yandex: 'your-yandex-verification-code',
    // },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#0e3b5e',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="tr" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="apple-touch-icon" href="/icons/icon-192.png" />
                {/* Schema.org JSON-LD for SEO */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'WebApplication',
                            name: 'FinTechTerms',
                            description: 'Türkçe, İngilizce ve Rusça ekonomi, fintek ve bilişim terimlerini öğrenmek için SRS tabanlı akıllı sözlük uygulaması.',
                            url: 'https://fintechterms.vercel.app',
                            applicationCategory: 'EducationalApplication',
                            operatingSystem: 'Web',
                            offers: {
                                '@type': 'Offer',
                                price: '0',
                                priceCurrency: 'USD',
                            },
                            inLanguage: ['tr', 'en', 'ru'],
                            author: {
                                '@type': 'Organization',
                                name: 'FinTechTerms',
                            },
                        }),
                    }}
                />
            </head>
            <body className="antialiased" suppressHydrationWarning>
                <AuthProvider>
                    <LanguageProvider>
                        <SRSProvider>
                            <ToastProvider>
                                <div className="page-wrapper">
                                    <main className="max-w-lg mx-auto">
                                        {children}
                                    </main>
                                    <BottomNav />
                                </div>
                            </ToastProvider>
                        </SRSProvider>
                    </LanguageProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
