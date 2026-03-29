export const STUDY_SESSION_STORAGE_KEY = 'fintechterms_session';
export const STUDY_SESSION_TAB_ID_KEY = 'fintechterms_session_tab_id';

export interface StoredStudySessionContext {
    readonly sessionId: string;
    readonly sessionToken: string;
}

export const buildStudySessionStorageKey = (tabId: string): string => (
    `${STUDY_SESSION_STORAGE_KEY}:${tabId}`
);

export const getOrCreateStudySessionTabId = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const existingTabId = window.sessionStorage.getItem(STUDY_SESSION_TAB_ID_KEY);
        if (existingTabId) {
            return existingTabId;
        }

        const nextTabId = `tab_${globalThis.crypto.randomUUID()}`;
        window.sessionStorage.setItem(STUDY_SESSION_TAB_ID_KEY, nextTabId);
        return nextTabId;
    } catch {
        return null;
    }
};

export const readTrackedStudySessionContext = (): StoredStudySessionContext | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    const tabId = getOrCreateStudySessionTabId();
    if (!tabId) {
        return null;
    }

    try {
        const stored = window.sessionStorage.getItem(buildStudySessionStorageKey(tabId));
        if (!stored) {
            return null;
        }

        const parsed = JSON.parse(stored) as {
            id?: unknown;
            token?: unknown;
        };
        const sessionId = typeof parsed.id === 'string' ? parsed.id.trim() : '';
        const sessionToken = typeof parsed.token === 'string' ? parsed.token.trim() : '';

        if (!sessionId || !sessionToken) {
            return null;
        }

        return {
            sessionId,
            sessionToken,
        };
    } catch {
        return null;
    }
};
