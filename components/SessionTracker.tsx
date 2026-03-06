'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasResearchConsent } from './ConsentModal';

const SESSION_KEY = 'fintechterms_session';
const SESSION_UPDATE_INTERVAL = 30000; // 30 seconds

interface SessionData {
    id: string | null;
    startTime: number;
    pageViews: number;
    quizAttempts: number;
}

/**
 * SessionTracker - Invisible component that tracks user sessions
 * for academic research purposes
 */
export default function SessionTracker() {
    const { isAuthenticated } = useAuth();
    const sessionRef = useRef<SessionData | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const persistSessionMutation = useCallback(async (payload: Record<string, unknown>) => {
        const response = await fetch('/api/study-sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            keepalive: true,
        });

        if (!response.ok) {
            throw new Error('Study session request failed.');
        }

        return response.json();
    }, []);

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
    const startSession = useCallback(async () => {
        if (!hasResearchConsent()) return;

        const session: SessionData = {
            id: null,
            startTime: Date.now(),
            pageViews: 1,
            quizAttempts: 0,
        };

        sessionRef.current = session;

        // Store in localStorage for persistence
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch {
            // Silently fail
        }

        // Record session start through the trusted backend.
        try {
            const response = await persistSessionMutation({
                action: 'start',
                anonymousId: !isAuthenticated ? getAnonymousId() : null,
                deviceType: getDeviceType(),
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
                consentGiven: true,
            });

            session.id = response?.sessionId || null;
            sessionRef.current = session;

            try {
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            } catch {
                // Silently fail
            }
        } catch (error) {
            console.error('Failed to record session start:', error);
        }
    }, [isAuthenticated, getAnonymousId, getDeviceType, persistSessionMutation]);

    // Update session (called periodically)
    const updateSession = useCallback(async () => {
        if (!sessionRef.current || !hasResearchConsent()) return;

        const session = sessionRef.current;

        try {
            const stored = localStorage.getItem(SESSION_KEY);
            if (stored) {
                const persisted = JSON.parse(stored) as SessionData;
                session.pageViews = persisted.pageViews;
                session.quizAttempts = persisted.quizAttempts;
                session.id = persisted.id || session.id;
            }
        } catch {
            // Silently fail
        }

        const durationSeconds = Math.floor((Date.now() - session.startTime) / 1000);

        // Update in localStorage
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch {
            // Silently fail
        }

        if (!session.id) {
            return;
        }

        try {
            await persistSessionMutation({
                action: 'heartbeat',
                sessionId: session.id,
                anonymousId: !isAuthenticated ? getAnonymousId() : null,
                durationSeconds,
                pageViews: session.pageViews,
                quizAttempts: session.quizAttempts,
            });
        } catch (error) {
            console.error('Failed to update session:', error);
        }
    }, [isAuthenticated, getAnonymousId, persistSessionMutation]);

    // End session (called on unmount or page close)
    const endSession = useCallback(async () => {
        if (!sessionRef.current || !hasResearchConsent()) return;

        const session = sessionRef.current;

        try {
            const stored = localStorage.getItem(SESSION_KEY);
            if (stored) {
                const persisted = JSON.parse(stored) as SessionData;
                session.pageViews = persisted.pageViews;
                session.quizAttempts = persisted.quizAttempts;
                session.id = persisted.id || session.id;
            }
        } catch {
            // Silently fail
        }

        const durationSeconds = Math.floor((Date.now() - session.startTime) / 1000);

        if (!session.id) {
            try {
                localStorage.removeItem(SESSION_KEY);
            } catch {
                // Silently fail
            }
            return;
        }

        try {
            await persistSessionMutation({
                action: 'end',
                sessionId: session.id,
                anonymousId: !isAuthenticated ? getAnonymousId() : null,
                durationSeconds,
                pageViews: session.pageViews,
                quizAttempts: session.quizAttempts,
            });

            // Clear localStorage
            localStorage.removeItem(SESSION_KEY);
        } catch (error) {
            console.error('Failed to end session:', error);
        }
    }, [isAuthenticated, getAnonymousId, persistSessionMutation]);

    // Initialize session tracking
    useEffect(() => {
        // Start session on mount
        startSession();

        // Set up periodic updates
        intervalRef.current = setInterval(updateSession, SESSION_UPDATE_INTERVAL);

        // Handle page visibility changes
        const handleVisibilityChange = () => {
            if (document.hidden) {
                updateSession();
            }
        };

        // Handle page unload
        const handleBeforeUnload = () => {
            endSession();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            endSession();
        };
    }, [startSession, updateSession, endSession]);

    // Track page views
    useEffect(() => {
        if (sessionRef.current && hasResearchConsent()) {
            sessionRef.current.pageViews += 1;
        }
    }, []);

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
