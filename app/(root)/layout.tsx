import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import PublicAnalyticsConsent from '@/components/PublicAnalyticsConsent';
import { inter, jetbrainsMono } from '@/lib/fonts';
import { getSiteUrl } from '@/lib/site-url';
import { buildAbsoluteUrl, buildAbsoluteXDefaultAlternates, buildPublicOpenGraphImagePath } from '@/lib/seo-routing';

const siteUrl = getSiteUrl();
const rootOpenGraphImagePath = buildPublicOpenGraphImagePath('en');

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: 'FinTechTerms | Multilingual FinTech Glossary',
    description: 'A multilingual fintech, finance, and technology glossary with localized Russian, English, and Turkish public SEO pages.',
    alternates: {
        canonical: siteUrl,
        languages: buildAbsoluteXDefaultAlternates(),
    },
    icons: {
        icon: [
            { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' },
        ],
        shortcut: '/icons/icon-192.png',
        apple: '/icons/icon-192.png',
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
                url: buildAbsoluteUrl(rootOpenGraphImagePath),
                width: 1200,
                height: 630,
                alt: 'FinTechTerms public glossary',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'FinTechTerms | Multilingual FinTech Glossary',
        description: 'Public glossary architecture for fintech, finance, and technology terms across Russian, English, and Turkish.',
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
    return (
        <html lang="en">
            <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
                {children}
                <PublicAnalyticsConsent language="en" />
                <GoogleAnalytics />
            </body>
        </html>
    );
}
