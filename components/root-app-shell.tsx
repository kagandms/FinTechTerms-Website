'use client';

import type { ReactNode } from 'react';
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

interface RootAppShellProps {
    readonly children: ReactNode;
    readonly nonce?: string;
}

export default function RootAppShell({
    children,
    nonce,
}: RootAppShellProps) {
    return (
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
            <GoogleAnalytics nonce={nonce} />
        </ThemeProvider>
    );
}
