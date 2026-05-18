'use client';

import React, { useEffect, useState } from 'react';
import InstallButton, { isStandaloneDisplayMode } from '@/components/InstallButton';

interface InstallAppCardProps {
    readonly title: string;
    readonly description: string;
}

type InstallAppCardVisibility = 'pending' | 'visible' | 'hidden';

type StandaloneDisplayModeQuery = MediaQueryList & {
    readonly addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    readonly removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

const subscribeToStandaloneChanges = (
    mediaQuery: StandaloneDisplayModeQuery | null,
    listener: (event: MediaQueryListEvent) => void
): (() => void) => {
    if (!mediaQuery) {
        return () => undefined;
    }

    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', listener);

        return () => mediaQuery.removeEventListener('change', listener);
    }

    mediaQuery.addListener?.(listener);

    return () => mediaQuery.removeListener?.(listener);
};

/**
 * Shows the install prompt card only when the current browser shell can still install the app.
 */
export default function InstallAppCard({
    title,
    description,
}: InstallAppCardProps): React.JSX.Element | null {
    const [visibility, setVisibility] = useState<InstallAppCardVisibility>('pending');

    useEffect(() => {
        const syncVisibility = (): void => {
            setVisibility(isStandaloneDisplayMode() ? 'hidden' : 'visible');
        };
        const handleAppInstalled = (): void => {
            setVisibility('hidden');
        };
        const mediaQuery = typeof window.matchMedia === 'function'
            ? window.matchMedia('(display-mode: standalone)')
            : null;

        syncVisibility();
        const unsubscribeFromDisplayMode = subscribeToStandaloneChanges(mediaQuery, syncVisibility);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            unsubscribeFromDisplayMode();
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    if (visibility !== 'visible') {
        return null;
    }

    return (
        <section className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {title}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {description}
                </p>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
                <InstallButton variant="prominent" />
            </div>
        </section>
    );
}
