import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import '@/app/globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SRSProvider } from '@/contexts/SRSContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import BottomNav from '@/components/BottomNav';
import HydrationMarker from '@/components/HydrationMarker';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import SessionTracker from '@/components/SessionTracker';
import BadgeRealtimeNotifier from '@/components/profile/BadgeRealtimeNotifier';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { inter, jetbrainsMono } from '@/lib/fonts';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '@/lib/language';
import { getScriptNonce } from '@/lib/script-nonce';
import { getSiteUrl } from '@/lib/site-url';
import { buildAbsoluteUrl, buildAbsoluteXDefaultAlternates, buildPublicOpenGraphImagePath } from '@/lib/seo-routing';
import { getThemeBootstrapScript } from '@/lib/theme-bootstrap';

const siteUrl = getSiteUrl();
const rootOpenGraphImagePath = buildPublicOpenGraphImagePath('en');

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: 'FinTechTerms | Платформа изучения финансовой терминологии',
    description: 'Интеллектуальная образовательная платформа для изучения финансовой и IT-терминологии с использованием интервального повторения.',
    alternates: {
        canonical: siteUrl,
        languages: buildAbsoluteXDefaultAlternates(),
    },
    icons: {
        icon: [
            { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
        ],
        shortcut: '/icons/icon-192.png',
        apple: '/icons/icon-192.png',
    },
    manifest: '/manifest.json',
    openGraph: {
        title: 'FinTechTerms | Платформа изучения финансовой терминологии',
        description: 'Интеллектуальная образовательная платформа для изучения финансовой и IT-терминологии с использованием интервального повторения.',
        url: siteUrl,
        siteName: 'FinTechTerms',
        type: 'website',
        images: [
            {
                url: buildAbsoluteUrl(rootOpenGraphImagePath),
                width: 1200,
                height: 630,
                alt: 'FinTechTerms public glossary',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'FinTechTerms | Платформа изучения финансовой терминологии',
        description: 'Интеллектуальная образовательная платформа для изучения финансовой и IT-терминологии с использованием интервального повторения.',
        images: [buildAbsoluteUrl(rootOpenGraphImagePath)],
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
        <html lang={htmlLanguage} suppressHydrationWarning>
            <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
                <script
                    nonce={nonce}
                    dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }}
                />
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
