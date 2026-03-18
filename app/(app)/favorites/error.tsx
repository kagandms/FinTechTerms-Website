'use client';

import RouteErrorFallback from '@/components/RouteErrorFallback';

export default function FavoritesError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <RouteErrorFallback error={error} reset={reset} />;
}
