import type { Metadata } from 'next';
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

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default async function AppLayout({
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
