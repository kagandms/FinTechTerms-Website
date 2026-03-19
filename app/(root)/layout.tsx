import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { inter, jetbrainsMono } from '@/lib/fonts';
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
    const nonce = await getScriptNonce();

    return (
        <html lang="en">
            <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#f5f7fb] text-slate-950`}>
                {children}
                <GoogleAnalytics nonce={nonce} />
            </body>
        </html>
    );
}
