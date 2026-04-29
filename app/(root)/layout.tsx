import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import dynamic from 'next/dynamic';
import '@/app/globals.css';
import { inter, jetbrainsMono } from '@/lib/fonts';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '@/lib/language';
import { getScriptNonce } from '@/lib/script-nonce';
import { getSiteUrl } from '@/lib/site-url';
import { buildAbsoluteXDefaultAlternates } from '@/lib/seo-routing';
import { getThemeBootstrapScript } from '@/lib/theme-bootstrap';

const siteUrl = getSiteUrl();
const RootAppShell = dynamic(() => import('@/components/root-app-shell'));

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
                url: '/icons/icon-512.png',
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
        images: ['/icons/icon-512.png'],
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
            <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
                <script
                    nonce={nonce}
                    dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }}
                />
                <RootAppShell nonce={nonce}>
                    {children}
                </RootAppShell>
            </body>
        </html>
    );
}
