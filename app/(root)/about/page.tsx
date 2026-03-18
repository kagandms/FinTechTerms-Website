import { cookies, headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { buildLegacyStaticRedirectPath } from '@/lib/legacy-public-routes';
import { LANGUAGE_COOKIE_NAME } from '@/lib/language';

export default async function AboutRedirectPage({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const [cookieStore, headerStore, resolvedSearchParams] = await Promise.all([
        cookies(),
        headers(),
        searchParams,
    ]);

    permanentRedirect(buildLegacyStaticRedirectPath('/about', {
        queryLanguage: resolvedSearchParams.lang,
        cookieLanguage: cookieStore.get(LANGUAGE_COOKIE_NAME)?.value ?? null,
        acceptLanguage: headerStore.get('accept-language'),
    }));
}
