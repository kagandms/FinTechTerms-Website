export const RESEARCH_CONSENT_KEY = 'fintechterms_research_consent';
export const CONSENT_GRANTED_EVENT = 'consentGranted';
export const CONSENT_UPDATED_EVENT = 'researchConsentUpdated';

const CONSENT_VERSION = '1.0';

export interface ResearchConsentData {
    readonly given: boolean;
    readonly timestamp: string;
    readonly version: string;
}

interface StoredConsentShape {
    readonly given?: unknown;
}

const isStoredConsentShape = (value: unknown): value is StoredConsentShape => (
    typeof value === 'object' && value !== null
);

const parseStoredConsent = (storedValue: string | null): boolean | null => {
    if (!storedValue) {
        return null;
    }

    try {
        const parsedValue: unknown = JSON.parse(storedValue);
        if (!isStoredConsentShape(parsedValue) || typeof parsedValue.given !== 'boolean') {
            return null;
        }

        return parsedValue.given;
    } catch {
        return null;
    }
};

/**
 * Reads the browser-stored research consent decision.
 *
 * @returns `true` or `false` for an explicit decision, otherwise `null`.
 */
export function readResearchConsent(): boolean | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return parseStoredConsent(localStorage.getItem(RESEARCH_CONSENT_KEY));
    } catch {
        return null;
    }
}

/**
 * Returns whether the user has explicitly granted research analytics consent.
 *
 * @returns `true` only when consent is stored as granted.
 */
export function hasResearchConsent(): boolean {
    return readResearchConsent() === true;
}

/**
 * Persists a research analytics consent decision in browser storage.
 *
 * @param given - Whether consent was granted or declined.
 * @returns Whether the decision was persisted successfully.
 */
export function writeResearchConsent(given: boolean): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const consentData: ResearchConsentData = {
        given,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
    };

    try {
        localStorage.setItem(RESEARCH_CONSENT_KEY, JSON.stringify(consentData));
    } catch {
        return false;
    }

    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT));

    if (given) {
        window.dispatchEvent(new CustomEvent(CONSENT_GRANTED_EVENT));
    }

    return true;
}
