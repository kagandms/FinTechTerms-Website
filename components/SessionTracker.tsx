'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CONSENT_GRANTED_EVENT, hasResearchConsent } from './ConsentModal';
import { createIdempotencyKey } from '@/lib/idempotency';

const SESSION_KEY = 'fintechterms_session';
const SESSION_UPDATE_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_QUEUE_SIZE = 50;
type SessionMode = 'anonymous' | 'authenticated';

interface SessionData {
    id: string | null;
    startTime: number;
    pageViews: number;
    quizAttempts: number;
    authMode: SessionMode;
    anonymousId: string | null;
}

interface PersistSessionResult {
    ok: boolean;
    data: { sessionId?: string } | null;
    retryable: boolean;
}

interface StartSessionOptions {
    mode?: SessionMode;
    previousSessionId?: string | null;
    previousAnonymousId?: string | null;
}

type SessionMutationPayload =
    | {
        action: 'start';
        anonymousId: string | null;
        deviceType: string;
        userAgent: string | null;
        consentGiven: true;
        previous_session_id: string | null;
    }
    | {
        action: 'heartbeat' | 'end';
        sessionId: string;
        anonymousId: string | null;
        durationSeconds: number;
        pageViews: number;
        quizAttempts: number;
    };

interface QueuedSessionMutation {
    payload: SessionMutationPayload;
    sessionStartTime: number | null;
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

    const queueRetryableMutation = useCallback((entry: QueuedSessionMutation) => {
        retryQueueRef.current = [...retryQueueRef.current, entry].slice(-MAX_RETRY_QUEUE_SIZE);
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

    const applySessionIdToCurrentSession = useCallback((sessionStartTime: number | null, sessionId: string) => {
        if (sessionStartTime === null) {
            return;
        }

        const currentSession = sessionRef.current;
        if (!currentSession || currentSession.startTime !== sessionStartTime || currentSession.id === sessionId) {
            return;
        }

        const updatedSession = {
            ...currentSession,
            id: sessionId,
        };

        sessionRef.current = updatedSession;
        saveSessionToStorage(updatedSession);
    }, [saveSessionToStorage]);

    const persistSessionMutation = useCallback(async (payload: SessionMutationPayload): Promise<PersistSessionResult> => {
        try {
            const response = await fetch('/api/study-sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...payload,
                    idempotency_key: createIdempotencyKey(),
                }),
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

                if (!sessionId) {
                    return {
                        ok: false,
                        data: null,
                        retryable: true,
                    };
                }

                return {
                    ok: true,
                    data: { sessionId },
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
    }, []);

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

                const response = await persistSessionMutation(entry.payload);

                if (!response.ok) {
                    const remainingEntries = response.retryable
                        ? pending.slice(index)
                        : pending.slice(index + 1);
                    retryQueueRef.current = [...remainingEntries, ...retryQueueRef.current].slice(-MAX_RETRY_QUEUE_SIZE);
                    break;
                }

                if (entry.payload.action === 'start' && response.data?.sessionId) {
                    applySessionIdToCurrentSession(entry.sessionStartTime, response.data.sessionId);
                }
            }
        } finally {
            isFlushingQueueRef.current = false;
        }
    }, [applySessionIdToCurrentSession, persistSessionMutation]);

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
        previousAnonymousId = null,
    }: StartSessionOptions = {}) => {
        if (!hasResearchConsent()) return;

        const requestAnonymousId = mode === 'anonymous'
            ? (previousAnonymousId ?? getAnonymousId())
            : previousAnonymousId;
        const session: SessionData = {
            id: null,
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
        };

        try {
            const response = await persistSessionMutation(startPayload);

            if (!response.ok) {
                if (response.retryable) {
                    queueRetryableMutation({
                        payload: startPayload,
                        sessionStartTime: session.startTime,
                    });
                }
                return;
            }

            session.id = response.data?.sessionId || null;
            sessionRef.current = session;
            saveSessionToStorage(session);
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

        if (!session.id) {
            return;
        }

        const heartbeatPayload: SessionMutationPayload = {
            action: 'heartbeat',
            sessionId: session.id,
            anonymousId: session.authMode === 'anonymous' ? session.anonymousId : null,
            durationSeconds,
            pageViews: session.pageViews,
            quizAttempts: session.quizAttempts,
        };

        try {
            const response = await persistSessionMutation(heartbeatPayload);

            if (!response.ok) {
                if (response.retryable) {
                    queueRetryableMutation({
                        payload: heartbeatPayload,
                        sessionStartTime: session.startTime,
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

        const durationSeconds = Math.floor((Date.now() - session.startTime) / 1000);

        if (!session.id) {
            sessionRef.current = null;
            lastTrackedPathnameRef.current = null;
            saveSessionToStorage(null);
            return;
        }

        const endPayload: SessionMutationPayload = {
            action: 'end',
            sessionId: session.id,
            anonymousId: session.authMode === 'anonymous' ? session.anonymousId : null,
            durationSeconds,
            pageViews: session.pageViews,
            quizAttempts: session.quizAttempts,
        };

        try {
            const response = await persistSessionMutation(endPayload);

            if (!response.ok) {
                if (response.retryable) {
                    queueRetryableMutation({
                        payload: endPayload,
                        sessionStartTime: session.startTime,
                    });
                }
                return;
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
    }, [flushRetryQueue, hydrateSessionFromStorage, persistSessionMutation, queueRetryableMutation, saveSessionToStorage]);

    useEffect(() => {
        authStateRef.current = isAuthenticated;
    }, [isAuthenticated]);

    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    // Initialize session tracking
    useEffect(() => {
        // Start session on mount
        void startSession();

        // Set up periodic updates
        intervalRef.current = setInterval(updateSession, SESSION_UPDATE_INTERVAL);

        // Handle page visibility changes
        const handleVisibilityChange = () => {
            if (document.hidden) {
                void updateSession();
            }
        };

        // Handle page unload
        const handleBeforeUnload = () => {
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
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener(CONSENT_GRANTED_EVENT, handleConsentGranted);
            window.removeEventListener('online', handleOnline);
            void endSession();
        };
    }, [endSession, flushRetryQueue, startSession, trackPageView, updateSession]);

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
        const previousAnonymousId = currentSession.authMode === 'anonymous'
            ? currentSession.anonymousId
            : null;

        void (async () => {
            await endSession();
            await startSession({
                mode: isAuthenticated ? 'authenticated' : 'anonymous',
                previousSessionId: !previousAuthState && isAuthenticated ? previousSessionId : null,
                previousAnonymousId,
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
