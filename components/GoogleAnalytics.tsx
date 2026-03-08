'use client';

import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';
import { CONSENT_GRANTED_EVENT } from './ConsentModal';

const GA_ID = 'G-9CK0M7NSGD';
const CONSENT_KEY = 'fintechterms_research_consent';

/**
 * Google Analytics component that only loads AFTER user gives consent.
 * Checks localStorage for consent flag set by ConsentModal.
 * Compliant with GDPR/KVKK regulations.
 */
export default function GoogleAnalytics() {
    const [hasConsent, setHasConsent] = useState(false);
    const syncConsentState = useCallback(() => {
        try {
            const stored = localStorage.getItem(CONSENT_KEY);
            if (!stored) {
                setHasConsent(false);
                return;
            }

            const data = JSON.parse(stored);
            setHasConsent(data.given === true);
        } catch {
            setHasConsent(false);
        }
    }, []);

    useEffect(() => {
        syncConsentState();

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

    if (!hasConsent) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${GA_ID}');
                `}
            </Script>
        </>
    );
}
