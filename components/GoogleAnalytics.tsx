'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const GA_ID = 'G-XMLQTYLY25';
const CONSENT_KEY = 'fintechterms_research_consent';

/**
 * Google Analytics component that only loads AFTER user gives consent.
 * Checks localStorage for consent flag set by ConsentModal.
 * Compliant with GDPR/KVKK regulations.
 */
export default function GoogleAnalytics() {
    const [hasConsent, setHasConsent] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(CONSENT_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.given === true) {
                    setHasConsent(true);
                }
            }
        } catch {
            // localStorage not available
        }

        // Listen for consent changes (in case user accepts while page is open)
        const handleStorage = (e: StorageEvent) => {
            if (e.key === CONSENT_KEY && e.newValue) {
                try {
                    const data = JSON.parse(e.newValue);
                    setHasConsent(data.given === true);
                } catch {
                    // Invalid JSON
                }
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

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
