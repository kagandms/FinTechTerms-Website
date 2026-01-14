import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SRSProvider } from '@/contexts/SRSContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import BottomNav from '@/components/BottomNav';
import ConsentModal from '@/components/ConsentModal';
import SessionTracker from '@/components/SessionTracker';

const siteUrl = 'https://fintechterms.vercel.app';


export const metadata: Metadata = {
    // Basic Meta
    title: {
        default: 'FinTechTerms | Finans ve Teknoloji Sözlüğü (TR-EN-RU)',
        template: '%s | FinTechTerms - Finansal Sözlük',
    },
    description: 'FinTechTerms ile Finans, Bilişim, Yapay Zeka ve Blockchain terimlerini öğrenin. Türkçe, İngilizce ve Rusça açıklamalı, SRS tabanlı akıllı sözlük ve flashcard uygulaması.',
    keywords: [
        // Brand
        'FinTechTerms', 'FinTerms', 'FTT',
        // General
        'Finans Sözlüğü', 'Fintech Sözlüğü', 'Ekonomi Terimleri', 'Bilişim Sözlüğü',
        'Financial Dictionary', 'Fintech Dictionary', 'Economic Terms', 'IT Dictionary',
        'Финансовый словарь', 'Финтех словарь', 'Экономические термины', 'IT словарь',
        // Specific Topics
        'Blockchain', 'Kripto Para', 'Yapay Zeka', 'Machine Learning', 'AI Terms',
        'DeFi', 'NFT', 'SaaS', 'PaaS', 'IaaS', 'Cloud Computing',
        // Education/Method
        'SRS', 'Spaced Repetition', 'Aralıklı Tekrar', 'Flashcard', 'Kelime Ezberleme',
        'İngilizce Öğren', 'Rusça Öğren', 'Finansal Okuryazarlık',
        // Variations
        'nedir', 'ne demek', 'anlamı', 'what is', 'meaning', 'что это', 'значение',
        'Terimler', 'Kavramlar', 'Terminology', 'Vocabulary',
        'Bankacılık', 'Banking', 'Банковское дело',
        'Yatırım', 'Investment', 'Инвестиции'
    ],
    authors: [{ name: 'FinTechTerms Team', url: siteUrl }],
    creator: 'FinTechTerms',
    publisher: 'FinTechTerms',
    applicationName: 'FinTechTerms',

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
        nocache: false,
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
        title: 'FinTechTerms | Küresel Finans ve Teknoloji Sözlüğü',
        description: 'Fintech, Ekonomi ve Yazılım dünyasına hakim olun. Türkçe, İngilizce ve Rusça terimler, akıllı öğrenme sistemi ile cebinizde.',
        url: siteUrl,
        siteName: 'FinTechTerms',
        locale: 'tr_TR',
        alternateLocale: ['en_US', 'ru_RU'],
        type: 'website',
        images: [
            {
                url: '/og-image.png', // Ensure this exists or use ftt.png as fallback if dedicated generic card absent
                width: 1200,
                height: 630,
                alt: 'FinTechTerms - Trilingual Dictionary Interface',
            },
        ],
    },

    // Twitter
    twitter: {
        card: 'summary_large_image',
        title: 'FinTechTerms | Finans ve Teknoloji Dünyası',
        description: 'Fintech, Ekonomi ve Yazılım terimlerini 3 dilde öğrenin. SRS algoritması ile unutmaya son.',
        images: ['/og-image.png'],
        creator: '@fintechterms',
        site: '@fintechterms',
    },

    // Category & Classification
    category: 'education',

    // PWA
    manifest: '/manifest.json',
    icons: {
        icon: '/favicon.ico',
        shortcut: '/favicon.ico',
        apple: '/icons/icon-192.png',
        other: [
            {
                rel: 'apple-touch-icon-precomposed',
                url: '/icons/icon-192.png',
            },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'FinTechTerms',
    },

    // Search Engine Checks
    verification: {
        google: 'google-site-verification-code', // User needs to provide this actually
        // yandex: 'yandex-verification',
    },
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
                <ThemeProvider>
                    <AuthProvider>
                        <LanguageProvider>
                            <SRSProvider>
                                <ToastProvider>
                                    <div className="page-wrapper">
                                        <main className="max-w-lg mx-auto">
                                            {children}
                                        </main>
                                        <BottomNav />
                                        <ConsentModal />
                                        <SessionTracker />
                                    </div>
                                </ToastProvider>
                            </SRSProvider>
                        </LanguageProvider>
                    </AuthProvider>
                </ThemeProvider>
                <Script
                    src="https://www.googletagmanager.com/gtag/js?id=G-XMLQTYLY25"
                    strategy="afterInteractive"
                />
                <Script id="google-analytics" strategy="afterInteractive">
                    {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());

                        gtag('config', 'G-XMLQTYLY25');
                    `}
                </Script>
            </body>
        </html>
    );
}
