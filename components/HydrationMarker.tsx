'use client';

import { useEffect } from 'react';

export default function HydrationMarker() {
    useEffect(() => {
        document.documentElement.dataset.appReady = 'true';

        return () => {
            delete document.documentElement.dataset.appReady;
        };
    }, []);

    return null;
}
