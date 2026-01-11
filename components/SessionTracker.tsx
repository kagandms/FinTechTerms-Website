'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { hasResearchConsent } from './ConsentModal';

const SESSION_KEY = 'fintechterms_session';
const SESSION_UPDATE_INTERVAL = 30000; // 30 seconds

interface SessionData {
    id: string;
    startTime: number;
    pageViews: number;
    quizAttempts: number;
}

/**
 * SessionTracker - Invisible component that tracks user sessions
 * for academic research purposes
 */
export default function SessionTracker() {
    const { user, isAuthenticated } = useAuth();
    const sessionRef = useRef<SessionData | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const session: SessionData = {
            id: sessionId,
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

        // Record session start in Supabase
        try {
            await supabase.from('study_sessions').insert({
                user_id: isAuthenticated && user ? user.id : null,
                anonymous_id: !isAuthenticated ? getAnonymousId() : null,
                session_start: new Date().toISOString(),
                device_type: getDeviceType(),
                user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
                consent_given: true,
                consent_timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Failed to record session start:', error);
        }
    }, [isAuthenticated, user, getAnonymousId, getDeviceType]);

    // Update session (called periodically)
    const updateSession = useCallback(async () => {
        if (!sessionRef.current || !hasResearchConsent()) return;

        const session = sessionRef.current;
        const durationSeconds = Math.floor((Date.now() - session.startTime) / 1000);

        // Update in localStorage
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch {
            // Silently fail
        }

        // Update in Supabase
        try {
            const userId = isAuthenticated && user ? user.id : null;
            const anonId = !isAuthenticated ? getAnonymousId() : null;

            await supabase
                .from('study_sessions')
                .update({
                    duration_seconds: durationSeconds,
                    page_views: session.pageViews,
                    quiz_attempts: session.quizAttempts,
                })
                .eq(userId ? 'user_id' : 'anonymous_id', userId || anonId)
                .order('session_start', { ascending: false })
                .limit(1);
        } catch (error) {
            console.error('Failed to update session:', error);
        }
    }, [isAuthenticated, user, getAnonymousId]);

    // End session (called on unmount or page close)
    const endSession = useCallback(async () => {
        if (!sessionRef.current || !hasResearchConsent()) return;

        const session = sessionRef.current;
        const durationSeconds = Math.floor((Date.now() - session.startTime) / 1000);

        try {
            const userId = isAuthenticated && user ? user.id : null;
            const anonId = !isAuthenticated ? getAnonymousId() : null;

            await supabase
                .from('study_sessions')
                .update({
                    session_end: new Date().toISOString(),
                    duration_seconds: durationSeconds,
                    page_views: session.pageViews,
                    quiz_attempts: session.quizAttempts,
                })
                .eq(userId ? 'user_id' : 'anonymous_id', userId || anonId)
                .order('session_start', { ascending: false })
                .limit(1);

            // Clear localStorage
            localStorage.removeItem(SESSION_KEY);
        } catch (error) {
            console.error('Failed to end session:', error);
        }
    }, [isAuthenticated, user, getAnonymousId]);

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
