const DEFAULT_GOOGLE_OAUTH_REDIRECT_PATH = '/profile?complete=1';
const GOOGLE_OAUTH_START_PATH = '/api/auth/oauth/google';

interface BuildGoogleOAuthStartPathOptions {
    readonly redirectTo?: string | null;
}

const isSafeInternalPath = (path: string): boolean => {
    const trimmedPath = path.trim();

    return (
        trimmedPath.startsWith('/')
        && !trimmedPath.startsWith('//')
        && !trimmedPath.startsWith('/\\')
        && !trimmedPath.includes('\n')
        && !trimmedPath.includes('\r')
    );
};

const resolveGoogleOAuthRedirectPath = (redirectTo?: string | null): string => {
    if (!redirectTo || !isSafeInternalPath(redirectTo)) {
        return DEFAULT_GOOGLE_OAUTH_REDIRECT_PATH;
    }

    return redirectTo.trim();
};

export const buildGoogleOAuthStartPath = (
    options: BuildGoogleOAuthStartPathOptions = {}
): string => {
    const redirectTo = resolveGoogleOAuthRedirectPath(options.redirectTo);
    return `${GOOGLE_OAUTH_START_PATH}?redirectTo=${encodeURIComponent(redirectTo)}`;
};
