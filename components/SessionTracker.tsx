'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CONSENT_GRANTED_EVENT, hasResearchConsent } from './ConsentModal';
import { createIdempotencyKey } from '@/lib/idempotency';

const SESSION_KEY = 'fintechterms_session';
const PENDING_END_SESSION_KEY = 'fintechterms_pending_end_session';
const SESSION_UPDATE_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_QUEUE_SIZE = 50;
type SessionMode = 'anonymous' | 'authenticated';

interface SessionData {
    id: string | null;
    token: string | null;
    startTime: number;
    pageViews: number;
    quizAttempts: number;
    authMode: SessionMode;
    anonymousId: string | null;
}

interface PersistSessionResult {
    ok: boolean;
    data: { sessionId?: string; sessionToken?: string } | null;
    retryable: boolean;
}

interface StartSessionOptions {
    mode?: SessionMode;
    previousSessionId?: string | null;
    previousSessionToken?: string | null;
}

type StartSessionMutationPayload = {
    action: 'start';
    anonymousId: string | null;
    deviceType: string;
    userAgent: string | null;
    consentGiven: true;
    previous_session_id: string | null;
    previous_session_token?: string | null;
};

type HeartbeatSessionMutationPayload = {
    action: 'heartbeat';
    sessionId: string;
    sessionToken: string;
    durationSeconds: number;
    pageViews: number;
    quizAttempts: number;
};

type EndSessionMutationPayload = {
    action: 'end';
    sessionId: string;
    sessionToken: string;
    durationSeconds: number;
    pageViews: number;
    quizAttempts: number;
};

type SessionMutationPayload =
    | StartSessionMutationPayload
    | HeartbeatSessionMutationPayload
    | EndSessionMutationPayload;

interface QueuedSessionMutation {
    payload: SessionMutationPayload;
    sessionStartTime: number | null;
    idempotencyKey: string;
}

interface PendingEndSessionMutation {
    payload: EndSessionMutationPayload;
    idempotencyKey: string;
}

/**
 * SessionTracker - Invisible component that tracks user sessions
 * for academic research purposes
 */
export default function SessionTracker() {
    const { isAuthenticated } = useAuth();
    const pathname = usePathname();
    const sessionRef = useRef<SessionData | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const authStateRef = useRef(isAuthenticated);
    const previousAuthStateRef = useRef(isAuthenticated);
    const lastTrackedPathnameRef = useRef<string | null>(null);
    const pathnameRef = useRef(pathname);
    const retryQueueRef = useRef<QueuedSessionMutation[]>([]);
    const isFlushingQueueRef = useRef(false);
    const startKeyRef = useRef<string | null>(null);
    const endKeyRef = useRef<string | null>(null);
    const pendingEndPayloadRef = useRef<PendingEndSessionMutation | null>(null);

    const queueRetryableMutation = useCallback((entry: QueuedSessionMutation) => {
        retryQueueRef.current = [...retryQueueRef.current, entry].slice(-MAX_RETRY_QUEUE_SIZE);
    }, []);

    const clearPendingEndSession = useCallback((expectedIdempotencyKey?: string) => {
        const currentPending = pendingEndPayloadRef.current;
        if (
            expectedIdempotencyKey
            && currentPending
            && currentPending.idempotencyKey !== expectedIdempotencyKey
        ) {
            return;
        }

        pendingEndPayloadRef.current = null;

        try {
            const stored = sessionStorage.getItem(PENDING_END_SESSION_KEY);
            if (!stored) {
                return;
            }

            const parsed = JSON.parse(stored) as Partial<PendingEndSessionMutation>;
            if (
                expectedIdempotencyKey
                && parsed.idempotencyKey
                && parsed.idempotencyKey !== expectedIdempotencyKey
            ) {
                return;
            }

            sessionStorage.removeItem(PENDING_END_SESSION_KEY);
        } catch {
            sessionStorage.removeItem(PENDING_END_SESSION_KEY);
        }
    }, []);

    const persistPendingEndSession = useCallback((pending: PendingEndSessionMutation) => {
        pendingEndPayloadRef.current = pending;

        try {
            sessionStorage.setItem(PENDING_END_SESSION_KEY, JSON.stringify(pending));
        } catch {
            // Best-effort persistence only.
        }
    }, []);

    const readPendingEndSession = useCallback((): PendingEndSessionMutation | null => {
        if (pendingEndPayloadRef.current) {
            return pendingEndPayloadRef.current;
        }

        try {
            const stored = sessionStorage.getItem(PENDING_END_SESSION_KEY);
            if (!stored) {
                return null;
            }

            const parsed = JSON.parse(stored) as Partial<PendingEndSessionMutation>;
            if (
                !parsed
                || typeof parsed !== 'object'
                || !parsed.payload
                || typeof parsed.idempotencyKey !== 'string'
            ) {
                return null;
            }

            const pending = parsed as PendingEndSessionMutation;
            pendingEndPayloadRef.current = pending;
            return pending;
        } catch {
            return null;
        }
    }, []);

    const saveSessionToStorage = useCallback((session: SessionData | null) => {
        try {
            if (session) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                return;
            }

            localStorage.removeItem(SESSION_KEY);
        } catch {
            // Silently fail
        }
    }, []);

    const hydrateSessionFromStorage = useCallback((session: SessionData): SessionData => {
        try {
            const stored = localStorage.getItem(SESSION_KEY);
            if (!stored) {
                return session;
            }

            const persisted = JSON.parse(stored) as Partial<SessionData>;
            return {
                ...session,
                id: typeof persisted.id === 'string' ? persisted.id : session.id,
                token: typeof persisted.token === 'string' ? persisted.token : session.token,
                pageViews: typeof persisted.pageViews === 'number' ? persisted.pageViews : session.pageViews,
                quizAttempts: typeof persisted.quizAttempts === 'number' ? persisted.quizAttempts : session.quizAttempts,
                authMode: persisted.authMode === 'anonymous' || persisted.authMode === 'authenticated'
                    ? persisted.authMode
                    : session.authMode,
                anonymousId: typeof persisted.anonymousId === 'string' ? persisted.anonymousId : session.anonymousId,
            };
        } catch {
            return session;
        }
    }, []);

    const applyStartResponseToCurrentSession = useCallback((
        sessionStartTime: number | null,
        nextSessionId: string,
        nextSessionToken: string
    ) => {
        if (sessionStartTime === null) {
            return;
        }

        const currentSession = sessionRef.current;
        if (
            !currentSession
            || currentSession.startTime !== sessionStartTime
            || (
                currentSession.id === nextSessionId
                && currentSession.token === nextSessionToken
            )
        ) {
            return;
        }

        const updatedSession = {
            ...currentSession,
            id: nextSessionId,
            token: nextSessionToken,
        };

        sessionRef.current = updatedSession;
        saveSessionToStorage(updatedSession);
    }, [saveSessionToStorage]);

    const buildMutationBody = useCallback((
        payload: SessionMutationPayload,
        idempotencyKey: string
    ) => JSON.stringify({
        ...payload,
        idempotency_key: idempotencyKey,
    }), []);

    const persistSessionMutation = useCallback(async (
        payload: SessionMutationPayload,
        idempotencyKey: string
    ): Promise<PersistSessionResult> => {
        try {
            const response = await fetch('/api/study-sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: buildMutationBody(payload, idempotencyKey),
                keepalive: true,
            });

            let responseBody: unknown = null;

            try {
                responseBody = await response.json();
            } catch {
                responseBody = null;
            }

            if (response.status === 401) {
                return { ok: false, data: null, retryable: false };
            }

            if (!response.ok) {
                const retryable = (
                    typeof responseBody === 'object'
                    && responseBody !== null
                    && 'retryable' in responseBody
                    && typeof responseBody.retryable === 'boolean'
                )
                    ? responseBody.retryable
                    : response.status >= 500 || response.status === 429;

                return {
                    ok: false,
                    data: null,
                    retryable,
                };
            }

            if (typeof responseBody !== 'object' || responseBody === null) {
                return {
                    ok: false,
                    data: null,
                    retryable: true,
                };
            }

            if (payload.action === 'start') {
                const sessionId = 'sessionId' in responseBody && typeof responseBody.sessionId === 'string'
                    ? responseBody.sessionId
                    : null;
                const sessionToken = 'sessionToken' in responseBody && typeof responseBody.sessionToken === 'string'
                    ? responseBody.sessionToken
                    : null;

                if (!sessionId || !sessionToken) {
                    return {
                        ok: false,
                        data: null,
                        retryable: true,
                    };
                }

                return {
                    ok: true,
                    data: { sessionId, sessionToken },
                    retryable: false,
                };
            }

            return {
                ok: true,
                data: responseBody as { sessionId?: string },
                retryable: false,
            };
        } catch {
            return {
                ok: false,
                data: null,
                retryable: true,
            };
        }
    }, [buildMutationBody]);

    const flushRetryQueue = useCallback(async () => {
        if (isFlushingQueueRef.current || retryQueueRef.current.length === 0) {
            return;
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return;
        }

        isFlushingQueueRef.current = true;

        try {
            const pending = [...retryQueueRef.current];
            retryQueueRef.current = [];

            for (let index = 0; index < pending.length; index += 1) {
                const entry = pending[index];
                if (!entry) {
                    continue;
                }

                const response = await persistSessionMutation(entry.payload, entry.idempotencyKey);

                if (!response.ok) {
                    if (!response.retryable) {
                        if (entry.payload.action === 'start' && startKeyRef.current === entry.idempotencyKey) {
                            startKeyRef.current = null;
                        }

                        if (entry.payload.action === 'end') {
                            if (endKeyRef.current === entry.idempotencyKey) {
                                endKeyRef.current = null;
                            }
                            clearPendingEndSession(entry.idempotencyKey);
                        }
                    }

                    const remainingEntries = response.retryable
                        ? pending.slice(index)
                        : pending.slice(index + 1);
                    retryQueueRef.current = [...remainingEntries, ...retryQueueRef.current].slice(-MAX_RETRY_QUEUE_SIZE);
                    break;
                }

                if (
                    entry.payload.action === 'start'
                    && response.data?.sessionId
                    && response.data.sessionToken
                ) {
                    applyStartResponseToCurrentSession(
                        entry.sessionStartTime,
                        response.data.sessionId,
                        response.data.sessionToken
                    );
                    if (startKeyRef.current === entry.idempotencyKey) {
                        startKeyRef.current = null;
                    }
                }

                if (entry.payload.action === 'end') {
                    if (endKeyRef.current === entry.idempotencyKey) {
                        endKeyRef.current = null;
                    }
                    clearPendingEndSession(entry.idempotencyKey);
                }
            }
        } finally {
            isFlushingQueueRef.current = false;
        }
    }, [applyStartResponseToCurrentSession, clearPendingEndSession, persistSessionMutation]);

    // Generate anonymous ID for non-authenticated users
    const getAnonymousId = useCallback((): string => {
        try {
            let anonId = localStorage.getItem('fintechterms_anon_id');
            if (!anonId) {
                anonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                localStorage.setItem('fintechterms_anon_id', anonId);
            }
            return anonId;
        } catch {
            return `anon_${Date.now()}`;
        }
    }, []);

    // Get device type
    const getDeviceType = useCallback((): string => {
        if (typeof window === 'undefined') return 'unknown';
        const width = window.innerWidth;
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    }, []);

    const buildEndPayload = useCallback((session: SessionData): EndSessionMutationPayload => ({
        action: 'end',
        sessionId: session.id as string,
        sessionToken: session.token as string,
        durationSeconds: Math.floor((Date.now() - session.startTime) / 1000),
        pageViews: session.pageViews,
        quizAttempts: session.quizAttempts,
    }), []);

    const getPendingEndSessionForCurrentState = useCallback((): PendingEndSessionMutation | null => {
        if (!sessionRef.current || !hasResearchConsent()) {
            return null;
        }

        const session = hydrateSessionFromStorage(sessionRef.current);
        sessionRef.current = session;

        if (!session.id || !session.token) {
            return null;
        }

        const idempotencyKey = endKeyRef.current ?? createIdempotencyKey();
        endKeyRef.current = idempotencyKey;

        const pending = {
            payload: buildEndPayload(session),
            idempotencyKey,
        };

        persistPendingEndSession(pending);
        return pending;
    }, [buildEndPayload, hydrateSessionFromStorage, persistPendingEndSession]);

    const sendPendingEndWithBeacon = useCallback((pending: PendingEndSessionMutation | null) => {
        if (
            !pending
            || typeof navigator === 'undefined'
            || typeof navigator.sendBeacon !== 'function'
        ) {
            return;
        }

        const body = buildMutationBody(pending.payload, pending.idempotencyKey);
        navigator.sendBeacon(
            '/api/study-sessions',
            new Blob([body], { type: 'application/json' })
        );
    }, [buildMutationBody]);

    const replayPendingEndSession = useCallback(async () => {
        const pending = readPendingEndSession();
        if (!pending) {
            return;
        }

        const response = await persistSessionMutation(pending.payload, pending.idempotencyKey);

        if (response.ok) {
            clearPendingEndSession(pending.idempotencyKey);
            if (endKeyRef.current === pending.idempotencyKey) {
                endKeyRef.current = null;
            }
            return;
        }

        if (response.retryable) {
            queueRetryableMutation({
                payload: pending.payload,
                sessionStartTime: null,
                idempotencyKey: pending.idempotencyKey,
            });
            return;
        }

        clearPendingEndSession(pending.idempotencyKey);
        if (endKeyRef.current === pending.idempotencyKey) {
            endKeyRef.current = null;
        }
    }, [clearPendingEndSession, persistSessionMutation, queueRetryableMutation, readPendingEndSession]);

    // Start a new session
    const trackPageView = useCallback((currentPathname: string | null) => {
        if (!currentPathname || !sessionRef.current || !hasResearchConsent()) {
            return;
        }

        if (lastTrackedPathnameRef.current === currentPathname) {
            return;
        }

        sessionRef.current.pageViews += 1;
        lastTrackedPathnameRef.current = currentPathname;
        saveSessionToStorage(sessionRef.current);
    }, [saveSessionToStorage]);

    const startSession = useCallback(async ({
        mode = authStateRef.current ? 'authenticated' : 'anonymous',
        previousSessionId = null,
        previousSessionToken = null,
    }: StartSessionOptions = {}) => {
        if (!hasResearchConsent()) return;

        const requestAnonymousId = mode === 'anonymous'
            ? getAnonymousId()
            : null;
        const session: SessionData = {
            id: null,
            token: null,
            startTime: Date.now(),
            pageViews: 0,
            quizAttempts: 0,
            authMode: mode,
            anonymousId: mode === 'anonymous' ? requestAnonymousId : null,
        };

        sessionRef.current = session;
        lastTrackedPathnameRef.current = null;
        saveSessionToStorage(session);

        // Record session start through the trusted backend.
        const startPayload: SessionMutationPayload = {
            action: 'start',
            anonymousId: requestAnonymousId,
            previous_session_id: previousSessionId,
            deviceType: getDeviceType(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            consentGiven: true,
            previous_session_token: previousSessionToken,
        };
        const startIdempotencyKey = startKeyRef.current ?? createIdempotencyKey();
        startKeyRef.current = startIdempotencyKey;

        try {
            const response = await persistSessionMutation(startPayload, startIdempotencyKey);

            if (!response.ok) {
                if (response.retryable) {
                    queueRetryableMutation({
                        payload: startPayload,
                        sessionStartTime: session.startTime,
                        idempotencyKey: startIdempotencyKey,
                    });
                } else if (startKeyRef.current === startIdempotencyKey) {
                    startKeyRef.current = null;
                }
                return;
            }

            session.id = response.data?.sessionId || null;
            session.token = response.data?.sessionToken || null;
            sessionRef.current = session;
            saveSessionToStorage(session);
            if (startKeyRef.current === startIdempotencyKey) {
                startKeyRef.current = null;
            }
            if (retryQueueRef.current.length > 0) {
                void flushRetryQueue();
            }
        } catch {
            // Session analytics must never interrupt the UI.
        }
    }, [flushRetryQueue, getAnonymousId, getDeviceType, persistSessionMutation, queueRetryableMutation, saveSessionToStorage]);

    // Update session (called periodically)
    const updateSession = useCallback(async () => {
        if (!sessionRef.current || !hasResearchConsent()) return;

        const session = hydrateSessionFromStorage(sessionRef.current);
        sessionRef.current = session;

        const durationSeconds = Math.floor((Date.now() - session.startTime) / 1000);
        saveSessionToStorage(session);

        if (!session.id || !session.token) {
            return;
        }

        const heartbeatPayload: SessionMutationPayload = {
            action: 'heartbeat',
            sessionId: session.id,
            sessionToken: session.token,
            durationSeconds,
            pageViews: session.pageViews,
            quizAttempts: session.quizAttempts,
        };
        const heartbeatIdempotencyKey = createIdempotencyKey();

        try {
            const response = await persistSessionMutation(heartbeatPayload, heartbeatIdempotencyKey);

            if (!response.ok) {
                if (response.retryable) {
                    queueRetryableMutation({
                        payload: heartbeatPayload,
                        sessionStartTime: session.startTime,
                        idempotencyKey: heartbeatIdempotencyKey,
                    });
                }
                return;
            }
            if (retryQueueRef.current.length > 0) {
                void flushRetryQueue();
            }
        } catch {
            // Session analytics must never interrupt the UI.
        }
    }, [flushRetryQueue, hydrateSessionFromStorage, persistSessionMutation, queueRetryableMutation, saveSessionToStorage]);

    // End session (called on unmount or page close)
    const endSession = useCallback(async () => {
        if (!sessionRef.current || !hasResearchConsent()) return;

        const session = hydrateSessionFromStorage(sessionRef.current);
        sessionRef.current = session;

        if (!session.id || !session.token) {
            sessionRef.current = null;
            lastTrackedPathnameRef.current = null;
            saveSessionToStorage(null);
            return;
        }

        const endPayload = buildEndPayload(session);
        const endIdempotencyKey = endKeyRef.current ?? createIdempotencyKey();
        endKeyRef.current = endIdempotencyKey;
        persistPendingEndSession({
            payload: endPayload,
            idempotencyKey: endIdempotencyKey,
        });

        try {
            const response = await persistSessionMutation(endPayload, endIdempotencyKey);

            if (!response.ok) {
                if (response.retryable) {
                    queueRetryableMutation({
                        payload: endPayload,
                        sessionStartTime: session.startTime,
                        idempotencyKey: endIdempotencyKey,
                    });
                } else {
                    clearPendingEndSession(endIdempotencyKey);
                    if (endKeyRef.current === endIdempotencyKey) {
                        endKeyRef.current = null;
                    }
                }
                return;
            }
            clearPendingEndSession(endIdempotencyKey);
            if (endKeyRef.current === endIdempotencyKey) {
                endKeyRef.current = null;
            }
            if (retryQueueRef.current.length > 0) {
                void flushRetryQueue();
            }
        } catch {
            // Session analytics must never interrupt the UI.
        } finally {
            sessionRef.current = null;
            lastTrackedPathnameRef.current = null;
            saveSessionToStorage(null);
        }
    }, [
        buildEndPayload,
        clearPendingEndSession,
        flushRetryQueue,
        hydrateSessionFromStorage,
        persistPendingEndSession,
        persistSessionMutation,
        queueRetryableMutation,
        saveSessionToStorage,
    ]);

    useEffect(() => {
        authStateRef.current = isAuthenticated;
    }, [isAuthenticated]);

    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    // Initialize session tracking
    useEffect(() => {
        let isMounted = true;

        void (async () => {
            await replayPendingEndSession();

            if (!isMounted) {
                return;
            }

            await startSession();
            if (!isMounted) {
                return;
            }

            trackPageView(pathnameRef.current);
        })();

        // Set up periodic updates
        intervalRef.current = setInterval(updateSession, SESSION_UPDATE_INTERVAL);

        // Handle page visibility changes
        const handleVisibilityChange = () => {
            if (document.hidden) {
                sendPendingEndWithBeacon(getPendingEndSessionForCurrentState());
                void updateSession();
            }
        };

        // Handle page unload
        const handleBeforeUnload = () => {
            sendPendingEndWithBeacon(getPendingEndSessionForCurrentState());
            void endSession();
        };

        const handleConsentGranted = () => {
            if (sessionRef.current || !hasResearchConsent()) {
                return;
            }

            void startSession();
            trackPageView(pathnameRef.current);
        };

        const handleOnline = () => {
            void flushRetryQueue();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener(CONSENT_GRANTED_EVENT, handleConsentGranted);
        window.addEventListener('online', handleOnline);

        return () => {
            isMounted = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener(CONSENT_GRANTED_EVENT, handleConsentGranted);
            window.removeEventListener('online', handleOnline);
            sendPendingEndWithBeacon(getPendingEndSessionForCurrentState());
            void endSession();
        };
    }, [
        endSession,
        flushRetryQueue,
        getPendingEndSessionForCurrentState,
        replayPendingEndSession,
        sendPendingEndWithBeacon,
        startSession,
        trackPageView,
        updateSession,
    ]);

    useEffect(() => {
        trackPageView(pathname);
    }, [pathname, trackPageView]);

    useEffect(() => {
        const previousAuthState = previousAuthStateRef.current;
        previousAuthStateRef.current = isAuthenticated;

        if (previousAuthState === isAuthenticated || !sessionRef.current || !hasResearchConsent()) {
            return;
        }

        const currentSession = hydrateSessionFromStorage(sessionRef.current);
        const previousSessionId = currentSession.id;
        const previousSessionToken = currentSession.token;

        void (async () => {
            await endSession();
            await startSession({
                mode: isAuthenticated ? 'authenticated' : 'anonymous',
                previousSessionId: !previousAuthState && isAuthenticated ? previousSessionId : null,
                previousSessionToken,
            });
            trackPageView(pathname);
        })();
    }, [endSession, hydrateSessionFromStorage, isAuthenticated, pathname, startSession, trackPageView]);

    // This component doesn't render anything
    return null;
}

/**
 * Increment quiz attempt count for current session
 */
export function incrementQuizAttempt() {
    try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
            const session: SessionData = JSON.parse(stored);
            session.quizAttempts += 1;
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
    } catch {
        // Silently fail
    }
}
