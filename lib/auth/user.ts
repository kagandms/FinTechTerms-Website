import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthenticatedUser {
    id: string;
    email: string | null;
    name: string;
    createdAt: string;
    primaryProvider: string | null;
    providers: string[];
}

const DISPLAY_NAME_METADATA_KEYS = [
    'full_name',
    'name',
    'preferred_username',
    'user_name',
    'nickname',
];
const BIRTH_DATE_METADATA_KEYS = ['birth_date'];

const normalizeString = (value: unknown): string => (
    typeof value === 'string' ? value.trim() : ''
);

const normalizeProvider = (value: unknown): string | null => {
    const normalizedValue = normalizeString(value).toLowerCase();
    return normalizedValue || null;
};

export const getSupabaseUserProviders = (
    supabaseUser: Pick<SupabaseUser, 'app_metadata'> | null | undefined
): string[] => {
    const providers = new Set<string>();
    const providerList = supabaseUser?.app_metadata?.providers;

    if (Array.isArray(providerList)) {
        for (const provider of providerList) {
            const normalizedProvider = normalizeProvider(provider);
            if (normalizedProvider) {
                providers.add(normalizedProvider);
            }
        }
    }

    const primaryProvider = normalizeProvider(supabaseUser?.app_metadata?.provider);
    if (primaryProvider) {
        providers.add(primaryProvider);
    }

    return Array.from(providers);
};

export const supportsPasswordSignIn = (
    supabaseUser: Pick<SupabaseUser, 'app_metadata' | 'email'> | null | undefined
): boolean => {
    const supportsEmailProvider = getSupabaseUserProviders(supabaseUser).includes('email');
    const email = (
        supabaseUser
        && 'email' in supabaseUser
        && typeof supabaseUser.email === 'string'
    )
        ? supabaseUser.email
        : null;

    return supportsEmailProvider && Boolean(email?.trim());
};

export const getSupabaseUserNameSeed = (
    supabaseUser: Pick<SupabaseUser, 'user_metadata' | 'email'> | null | undefined
): string => {
    const metadataName = getSupabaseUserMetadataName(supabaseUser);
    if (metadataName) {
        return metadataName;
    }

    const email = normalizeString(supabaseUser?.email);
    if (email.includes('@')) {
        return email.split('@')[0]?.trim() || '';
    }

    return '';
};

export const getSupabaseUserMetadataName = (
    supabaseUser: Pick<SupabaseUser, 'user_metadata'> | null | undefined
): string => {
    for (const key of DISPLAY_NAME_METADATA_KEYS) {
        const metadataValue = normalizeString(supabaseUser?.user_metadata?.[key]);
        if (metadataValue) {
            return metadataValue;
        }
    }

    return '';
};

export const getSupabaseUserMetadataBirthDate = (
    supabaseUser: Pick<SupabaseUser, 'user_metadata'> | null | undefined
): string => {
    for (const key of BIRTH_DATE_METADATA_KEYS) {
        const metadataValue = normalizeString(supabaseUser?.user_metadata?.[key]);
        if (metadataValue) {
            return metadataValue;
        }
    }

    return '';
};

export const getSupabaseUserDisplayName = (
    supabaseUser: Pick<SupabaseUser, 'id' | 'user_metadata' | 'email'> | null | undefined
): string => {
    const nameSeed = getSupabaseUserNameSeed(supabaseUser);
    if (nameSeed) {
        return nameSeed;
    }

    const fallbackId = normalizeString(supabaseUser?.id).replace(/-/g, '').slice(0, 6);
    return fallbackId ? `User ${fallbackId}` : 'User';
};

export const mapSupabaseUser = (supabaseUser: SupabaseUser): AuthenticatedUser => {
    const providers = getSupabaseUserProviders(supabaseUser);

    return {
        id: supabaseUser.id,
        email: supabaseUser.email ?? null,
        name: getSupabaseUserDisplayName(supabaseUser),
        createdAt: supabaseUser.created_at,
        primaryProvider: providers[0] ?? null,
        providers,
    };
};
