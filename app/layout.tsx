import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
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

const resolveSeoLanguage = (acceptLanguageHeader: string | null): SeoLanguage => {
    if (!acceptLanguageHeader) {
        return 'ru';
    }

    const orderedCodes = acceptLanguageHeader
        .split(',')
        .map((part) => part.trim().split(';')[0]?.toLowerCase() || '')
        .filter(Boolean);

    for (const code of orderedCodes) {
        if (code.startsWith('ru')) return 'ru';
        if (code.startsWith('tr')) return 'tr';
        if (code.startsWith('en')) return 'en';
    }

    return 'ru';
};

export async function generateMetadata(): Promise<Metadata> {
    const headerStore = await headers();
    const lang = resolveSeoLanguage(headerStore.get('accept-language'));
    const content = seoMeta[lang];

    return {
        metadataBase: new URL(siteUrl),
        title: {
            default: content.title,
            template: '%s | FinTechTerms',
        },
        description: content.description,
        alternates: {
            canonical: '/',
            languages: {
                'ru-RU': '/?lang=ru',
                'tr-TR': '/?lang=tr',
                'en-US': '/?lang=en',
            },
        },
        icons: {
            icon: '/favicon.ico',
            shortcut: '/favicon.ico',
            apple: '/apple-icon.png',
        },
        manifest: '/manifest.json',
        openGraph: {
            title: content.title,
            description: content.description,
            url: siteUrl,
            siteName: 'FinTechTerms',
            locale: content.ogLocale,
            alternateLocale: content.alternateLocale,
            type: 'website',
            images: [
                {
                    url: '/og-image.jpg',
                    width: 1200,
                    height: 630,
                    alt: 'FinTechTerms',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: content.title,
            description: content.description,
            images: ['/og-image.jpg'],
            creator: '@fintechterms',
            site: '@fintechterms',
        },
    };
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    themeColor: '#0e3b5e',
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const headerStore = await headers();
    const lang = resolveSeoLanguage(headerStore.get('accept-language'));
    const schemaDescription = seoMeta[lang].description;

    return (
        <html lang={lang} suppressHydrationWarning>
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'WebApplication',
                            name: 'FinTechTerms',
                            description: schemaDescription,
                            url: siteUrl,
                            applicationCategory: 'EducationalApplication',
                            operatingSystem: 'Web',
                            offers: {
                                '@type': 'Offer',
                                price: '0',
                                priceCurrency: 'USD',
                            },
                            inLanguage: ['ru', 'tr', 'en'],
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
