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

const siteUrl = 'https://fintechterms.vercel.app';


export const metadata: Metadata = {
    // Basic Meta
    title: {
        default: 'FinTechTerms | Global Finance & Technology Dictionary (EN-TR-RU)',
        template: '%s | FinTechTerms - Financial Dictionary',
    },
    description: 'Master Fintech, Finance, AI, and Blockchain terms. Trilingual dictionary with SRS-based smart flashcards in English, Turkish, and Russian.',
    keywords: [
        // Brand
        'FinTechTerms', 'FinTerms', 'FTT',
        // General
        'Finance Dictionary', 'Fintech Dictionary', 'Economic Terms', 'IT Dictionary',
        'Finans Sözlüğü', 'Fintech Sözlüğü', 'Ekonomi Terimleri', 'Bilişim Sözlüğü',
        'Финансовый словарь', 'Финтех словарь', 'Экономические термины', 'IT словарь',
        // Specific Topics
        'Blockchain', 'Crypto', 'AI', 'Machine Learning', 'DeFi', 'NFT', 'SaaS', 'Cloud Computing',
        // Education/Method
        'SRS', 'Spaced Repetition', 'Flashcard', 'Vocabulary', 'Learn English', 'Learn Turkish', 'Learn Russian',
        // Variations
        'definition', 'meaning', 'what is', 'nedir', 'ne demek', 'anlamı', 'что это', 'значение',
        'Terms', 'Concepts', 'Terminology',
        'Banking', 'Investment', 'Economics'
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
            'en-US': '/',
            'tr-TR': '/',
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
        title: 'FinTechTerms | Global Finance & Technology Dictionary',
        description: 'Master Fintech, Economics, and Software terms. English, Turkish, and Russian dictionary with smart SRS learning system.',
        url: siteUrl,
        siteName: 'FinTechTerms',
        locale: 'en_US',
        alternateLocale: ['tr_TR', 'ru_RU'],
        type: 'website',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'FinTechTerms - Trilingual Dictionary Interface',
            },
        ],
    },

    // Twitter
    twitter: {
        card: 'summary_large_image',
        title: 'FinTechTerms | World of Finance & Technology',
        description: 'Learn Fintech, Economics, and Tech terms in 3 languages. Never forget with SRS algorithm.',
        images: ['/og-image.png'],
        creator: '@fintechterms',
        site: '@fintechterms',
    },

    // Category & Classification
    category: 'education',

    // PWA
    manifest: '/manifest.json',
    icons: {
        icon: '/ftt.png',
        shortcut: '/ftt.png',
        apple: '/ftt.png',
        other: [
            {
                rel: 'apple-touch-icon-precomposed',
                url: '/ftt.png',
            },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'FinTechTerms',
    },

    verification: {
        google: 'ge-t3YnUICS7JWpdQTqwZA8eRw_O4kon-U-IH6EORLA',
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
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/ftt.png" sizes="any" />
                <link rel="apple-touch-icon" href="/ftt.png" />
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
                                        <main className="w-full max-w-lg md:max-w-5xl mx-auto transition-all duration-300">
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
                <GoogleAnalytics />
            </body>
        </html>
    );
}
