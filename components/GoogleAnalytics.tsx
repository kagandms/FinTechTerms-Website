'use client';

import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';
import { CONSENT_GRANTED_EVENT } from './ConsentModal';
import { getPublicEnv } from '@/lib/env';

const CONSENT_KEY = 'fintechterms_research_consent';

const readConsentState = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        const stored = localStorage.getItem(CONSENT_KEY);
        if (!stored) {
            return false;
        }

        const data = JSON.parse(stored);
        return data.given === true;
    } catch {
        return false;
    }
};

/**
 * Google Analytics component that only loads AFTER user gives consent.
 * Checks localStorage for consent flag set by ConsentModal.
 * Compliant with GDPR/KVKK regulations.
 */
export default function GoogleAnalytics() {
    const gaId = getPublicEnv().gaId;
    const [hasConsent, setHasConsent] = useState(readConsentState);
    const syncConsentState = useCallback(() => {
        setHasConsent(readConsentState());
    }, []);

    useEffect(() => {
        // Listen for consent changes (in case user accepts while page is open)
        const handleStorage = (e: StorageEvent) => {
            if (e.key === CONSENT_KEY && e.newValue) {
                syncConsentState();
            }
        };

        const initializeAnalytics = () => {
            syncConsentState();
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener(CONSENT_GRANTED_EVENT, initializeAnalytics);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(CONSENT_GRANTED_EVENT, initializeAnalytics);
        };
    }, [syncConsentState]);

    if (!gaId || !hasConsent) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${gaId}');
                `}
            </Script>
        </>
    );
}
