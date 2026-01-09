import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SRSProvider } from '@/contexts/SRSContext';
import { AuthProvider } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
    title: 'GlobalFinTerm | TR-EN-RU Ekonomi ve Bilişim Sözlüğü',
    description: 'Türkçe, İngilizce ve Rusça ekonomi, fintek ve bilişim terimlerini öğrenmek için SRS tabanlı akıllı sözlük uygulaması.',
    keywords: ['fintech', 'ekonomi', 'bilişim', 'sözlük', 'türkçe', 'ingilizce', 'rusça', 'SRS', 'flashcard'],
    authors: [{ name: 'GlobalFinTerm' }],
    manifest: '/manifest.json',
    openGraph: {
        title: 'GlobalFinTerm | TR-EN-RU Ekonomi ve Bilişim Sözlüğü',
        description: 'Türkçe, İngilizce ve Rusça ekonomi, fintek ve bilişim terimlerini öğrenmek için SRS tabanlı akıllı sözlük uygulaması.',
        url: 'https://globalfinterm.vercel.app',
        siteName: 'GlobalFinTerm',
        locale: 'tr_TR',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'GlobalFinTerm | TR-EN-RU Ekonomi ve Bilişim Sözlüğü',
        description: 'Trilingual ekonomi ve bilişim sözlüğü - SRS tabanlı akıllı öğrenme',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'GlobalFinTerm',
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
            </head>
            <body className="antialiased">
                <AuthProvider>
                    <LanguageProvider>
                        <SRSProvider>
                            <div className="page-wrapper">
                                <main className="max-w-lg mx-auto">
                                    {children}
                                </main>
                                <BottomNav />
                            </div>
                        </SRSProvider>
                    </LanguageProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
