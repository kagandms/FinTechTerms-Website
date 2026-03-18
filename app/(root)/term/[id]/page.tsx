import { cookies, headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { buildLegacyTermRedirectPath } from '@/lib/legacy-public-routes';
import { LANGUAGE_COOKIE_NAME } from '@/lib/language';

export default async function LegacyTermRedirectPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ lang?: string }>;
}) {
    const [cookieStore, headerStore, { id }, resolvedSearchParams] = await Promise.all([
        cookies(),
        headers(),
        params,
        searchParams,
    ]);
    const redirectPath = buildLegacyTermRedirectPath({
        termId: id,
        queryLanguage: resolvedSearchParams.lang,
        cookieLanguage: cookieStore.get(LANGUAGE_COOKIE_NAME)?.value ?? null,
        acceptLanguage: headerStore.get('accept-language'),
    });

    if (!redirectPath) {
        notFound();
    }

    permanentRedirect(redirectPath);
}
