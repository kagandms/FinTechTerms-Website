import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import '@/app/globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SRSProvider } from '@/contexts/SRSContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import BottomNav from '@/components/BottomNav';
import ConsentModal from '@/components/ConsentModal';
import HydrationMarker from '@/components/HydrationMarker';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import SessionTracker from '@/components/SessionTracker';
import BadgeRealtimeNotifier from '@/components/profile/BadgeRealtimeNotifier';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { inter, jetbrainsMono } from '@/lib/fonts';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '@/lib/language';
import { getScriptNonce } from '@/lib/script-nonce';
import { getSiteUrl } from '@/lib/site-url';
import { buildXDefaultAlternates } from '@/lib/seo-routing';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: 'FinTechTerms | Multilingual FinTech Glossary',
    description: 'A multilingual fintech, finance, and technology glossary with localized Russian, English, and Turkish public SEO pages.',
    alternates: {
        canonical: '/',
        languages: buildXDefaultAlternates(),
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
        title: 'FinTechTerms | Multilingual FinTech Glossary',
        description: 'Public glossary architecture for fintech, finance, and technology terms across Russian, English, and Turkish.',
        url: siteUrl,
        siteName: 'FinTechTerms',
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
        title: 'FinTechTerms | Multilingual FinTech Glossary',
        description: 'Public glossary architecture for fintech, finance, and technology terms across Russian, English, and Turkish.',
        images: ['/home-logo.png'],
        creator: '@fintechterms',
        site: '@fintechterms',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#0e3b5e',
};

export default async function RootSurfaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const nonce = await getScriptNonce();
    const htmlLanguage = normalizeLanguage(cookieStore.get('ftt-language')?.value) ?? DEFAULT_LANGUAGE;

    return (
        <html lang={htmlLanguage}>
            <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#f5f7fb] text-slate-950`}>
                <ThemeProvider>
                    <AuthProvider>
                        <LanguageProvider>
                            <ToastProvider>
                                <SRSProvider>
                                    <div className="page-wrapper">
                                        <main className="w-full max-w-lg md:max-w-5xl mx-auto transition-all duration-300">
                                            {children}
                                        </main>
                                        <BottomNav />
                                        <ConsentModal />
                                        <SessionTracker />
                                        <BadgeRealtimeNotifier />
                                        <ServiceWorkerRegistrar />
                                        <HydrationMarker />
                                    </div>
                                </SRSProvider>
                            </ToastProvider>
                        </LanguageProvider>
                    </AuthProvider>
                </ThemeProvider>
                <GoogleAnalytics nonce={nonce} />
            </body>
        </html>
    );
}
