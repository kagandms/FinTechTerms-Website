const PROTECTED_HOME_PREFIXES = [
    '/dashboard',
    '/search',
    '/quiz',
    '/profile',
    '/favorites',
    '/analytics',
    '/admin',
] as const;

export const isProtectedHomePath = (pathname: string | null | undefined): boolean => {
    if (!pathname) {
        return false;
    }

    return PROTECTED_HOME_PREFIXES.some((prefix) => (
        pathname === prefix || pathname.startsWith(`${prefix}/`)
    ));
};

export const resolveHomeHref = (pathname: string | null | undefined): string => {
    return isProtectedHomePath(pathname) ? '/dashboard' : '/';
};
