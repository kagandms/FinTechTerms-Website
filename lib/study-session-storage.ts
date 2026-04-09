export const STUDY_SESSION_STORAGE_KEY = 'fintechterms_session';
export const STUDY_SESSION_TAB_ID_KEY = 'fintechterms_session_tab_id';
export const STUDY_SESSION_READY_EVENT = 'fintechterms-study-session-ready';

export interface StoredStudySessionContext {
    readonly sessionId: string;
    readonly sessionToken: string;
}

export interface TrackedStudySessionState {
    readonly status: 'none' | 'pending' | 'ready' | 'corrupt';
    readonly context: StoredStudySessionContext | null;
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

export const readTrackedStudySessionState = (): TrackedStudySessionState => {
    if (typeof window === 'undefined') {
        return {
            status: 'none',
            context: null,
        };
    }

    const tabId = getOrCreateStudySessionTabId();
    if (!tabId) {
        return {
            status: 'none',
            context: null,
        };
    }

    try {
        const storageKey = buildStudySessionStorageKey(tabId);
        const stored = window.sessionStorage.getItem(storageKey);
        if (!stored) {
            return {
                status: 'none',
                context: null,
            };
        }

        const parsed = JSON.parse(stored) as {
            id?: unknown;
            token?: unknown;
        };
        const sessionId = typeof parsed.id === 'string' ? parsed.id.trim() : '';
        const sessionToken = typeof parsed.token === 'string' ? parsed.token.trim() : '';
        const hasSessionId = sessionId.length > 0;
        const hasSessionToken = sessionToken.length > 0;

        if (!hasSessionId && !hasSessionToken) {
            return {
                status: 'pending',
                context: null,
            };
        }

        if (!hasSessionId || !hasSessionToken) {
            window.sessionStorage.removeItem(storageKey);
            return {
                status: 'corrupt',
                context: null,
            };
        }

        return {
            status: 'ready',
            context: {
                sessionId,
                sessionToken,
            },
        };
    } catch {
        window.sessionStorage.removeItem(buildStudySessionStorageKey(tabId));
        return {
            status: 'corrupt',
            context: null,
        };
    }
};

export const readTrackedStudySessionContext = (): StoredStudySessionContext | null => (
    readTrackedStudySessionState().context
);

const waitForDelay = async (delayMs: number): Promise<void> => {
    await new Promise<void>((resolve) => {
        window.setTimeout(resolve, delayMs);
    });
};

export const waitForTrackedStudySessionContext = async (
    options: {
        timeoutMs?: number;
        pollIntervalMs?: number;
    } = {}
): Promise<StoredStudySessionContext | null> => {
    const timeoutMs = options.timeoutMs ?? 2_500;
    const pollIntervalMs = options.pollIntervalMs ?? 100;
    const initialState = readTrackedStudySessionState();

    if (initialState.status !== 'pending') {
        return initialState.context;
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await waitForDelay(pollIntervalMs);
        const nextState = readTrackedStudySessionState();

        if (nextState.status === 'ready') {
            return nextState.context;
        }

        if (nextState.status === 'none') {
            return null;
        }

        if (nextState.status === 'corrupt') {
            return null;
        }
    }

    return null;
};
