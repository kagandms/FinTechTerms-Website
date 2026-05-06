'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    CONSENT_GRANTED_EVENT,
    RESEARCH_CONSENT_KEY,
    hasResearchConsent,
} from '@/lib/research-consent';
import { getPublicEnv } from '@/lib/public-env';

const SCRIPT_ID = 'google-analytics-loader';

type GtagCommand =
    | ['js', Date]
    | ['config', string];

declare global {
    interface Window {
        dataLayer?: GtagCommand[];
        gtag?: (...args: GtagCommand) => void;
    }
}

const readConsentState = (): boolean => {
    return hasResearchConsent();
};

const appendGoogleAnalyticsScript = (gaId: string): void => {
    if (document.getElementById(SCRIPT_ID)) {
        return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(script);
};

const initializeGoogleAnalytics = (gaId: string): void => {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = window.gtag ?? ((...args: GtagCommand): void => {
        window.dataLayer?.push(args);
    });

    window.gtag('js', new Date());
    window.gtag('config', gaId);
    appendGoogleAnalyticsScript(gaId);
};

interface GoogleAnalyticsProps {
    nonce?: string;
}

/**
 * Google Analytics component that only loads AFTER user gives consent.
 * Checks localStorage for consent flag set by ConsentModal.
 * Compliant with GDPR/KVKK regulations.
 */
export default function GoogleAnalytics({ nonce: _nonce }: GoogleAnalyticsProps) {
    const gaId = getPublicEnv().gaId;
    const [hasConsent, setHasConsent] = useState(readConsentState);
    const syncConsentState = useCallback(() => {
        setHasConsent(readConsentState());
    }, []);

    useEffect(() => {
        // Listen for consent changes (in case user accepts while page is open)
        const handleStorage = (e: StorageEvent) => {
            if (e.key === RESEARCH_CONSENT_KEY && e.newValue) {
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

    useEffect(() => {
        if (!gaId || !hasConsent) {
            return;
        }

        initializeGoogleAnalytics(gaId);
    }, [gaId, hasConsent]);

    return null;
}
