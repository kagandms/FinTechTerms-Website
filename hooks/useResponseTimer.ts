'use client';

import { useState, useRef, useCallback } from 'react';

/**
 * Hook to measure response time for quiz answers
 * Returns start/stop functions and the measured duration
 */
export function useResponseTimer() {
    const [responseTime, setResponseTime] = useState<number>(0);
    const [isRunning, setIsRunning] = useState(false);
    const startTimeRef = useRef<number | null>(null);

    /**
     * Start the timer - call when showing a question
     */
    const startTimer = useCallback(() => {
        startTimeRef.current = performance.now();
        setResponseTime(0);
        setIsRunning(true);
    }, []);

    /**
     * Stop the timer and return elapsed time in milliseconds
     * Call when user submits an answer
     */
    const stopTimer = useCallback((): number => {
        if (startTimeRef.current === null) return 0;

        const elapsed = Math.round(performance.now() - startTimeRef.current);
        setResponseTime(elapsed);
        startTimeRef.current = null;
        setIsRunning(false);
        return elapsed;
    }, []);

    /**
     * Reset the timer without recording
     */
    const resetTimer = useCallback(() => {
        startTimeRef.current = null;
        setResponseTime(0);
        setIsRunning(false);
    }, []);

    /**
     * Get current elapsed time without stopping
     */
    const getElapsedTime = useCallback((): number => {
        if (startTimeRef.current === null) return 0;
        return Math.round(performance.now() - startTimeRef.current);
    }, []);

    return {
        responseTime,
        startTimer,
        stopTimer,
        resetTimer,
        getElapsedTime,
        isRunning,
    };
}
