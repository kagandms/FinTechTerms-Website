'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        const registerServiceWorker = async () => {
            try {
                await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            } catch (error) {
                logger.warn('SERVICE_WORKER_REGISTRATION_FAILED', {
                    route: 'ServiceWorkerRegistrar',
                    error: error instanceof Error ? error : undefined,
                });
            }
        };

        void registerServiceWorker();
    }, []);

    return null;
}
