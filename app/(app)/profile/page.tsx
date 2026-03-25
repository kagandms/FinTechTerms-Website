import ProfilePageClient from '@/app/profile/ProfilePageClient';
import { getLearningStats } from '@/app/actions/getLearningStats';
import { createOptionalClient } from '@/utils/supabase/server';
import type { ProfileFormInitialData } from '@/components/features/profile/ProfileEditForm';
import type { ProfileWarningCode } from '@/app/profile/ProfilePageClient';
import {
    getSupabaseUserMetadataBirthDate,
    getSupabaseUserMetadataName,
    getSupabaseUserNameSeed,
} from '@/lib/auth/user';
import { safeGetSupabaseUser } from '@/lib/auth/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const toDateInputValue = (value: unknown): string => {
    if (!value) return '';

    const raw = String(value).trim();
    if (!raw) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
        return raw.slice(0, 10);
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    const yyyy = parsed.getUTCFullYear();
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const splitName = (fullName: string) => {
    const trimmed = fullName.trim();
    if (!trimmed) {
        return { name: '', surname: '' };
    }

    const nameParts = trimmed.split(' ').filter(Boolean);
    return {
        name: nameParts[0] || '',
        surname: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
    };
};

const hasCompleteProfileInitialData = (
    value: ProfileFormInitialData | null
): value is ProfileFormInitialData => (
    Boolean(value?.name.trim())
    && Boolean(value?.surname.trim())
    && Boolean(value?.birthDate.trim())
    && value?.email !== null
);

const loadInitialProfileData = async (): Promise<{
    data: ProfileFormInitialData | null;
    warningCode: ProfileWarningCode | null;
}> => {
    let warningCode: ProfileWarningCode | null = null;
    let supabase = await createOptionalClient();

    if (!supabase) {
        return {
            data: null,
            warningCode: null,
        };
    }

    const authState = await safeGetSupabaseUser(supabase);
    if (!authState.user) {
        if (authState.ghostSession && authState.message) {
            logger.warn('PROFILE_RSC_GHOST_SESSION_RECOVERED', {
                route: '/profile',
                message: authState.message,
            });
        }

        return {
            data: null,
            warningCode: null,
        };
    }

    const user = authState.user;

    let fullName = getSupabaseUserMetadataName(user);
    let birthDate = toDateInputValue(getSupabaseUserMetadataBirthDate(user));

    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, birth_date')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) {
        logger.warn('PROFILE_RSC_FETCH_ERROR', {
            route: '/profile',
            userId: user.id,
            error: new Error(profileError.message),
        });
        warningCode = 'PROFILE_DATA_PARTIAL';
    } else if (profileData) {
        if (!fullName && profileData.full_name) {
            fullName = String(profileData.full_name).trim();
        }
        if (!birthDate && profileData.birth_date) {
            birthDate = toDateInputValue(profileData.birth_date);
        }
    }

    if (!fullName) {
        fullName = getSupabaseUserNameSeed(user);
    }

    const { name, surname } = splitName(fullName);

    const resolvedData: ProfileFormInitialData = {
        userId: user.id,
        email: user.email ?? null,
        name,
        surname,
        birthDate,
    };

    return {
        data: hasCompleteProfileInitialData(resolvedData) ? resolvedData : null,
        warningCode,
    };
};

export default async function ProfilePage() {
    const {
        data: initialProfileData,
        warningCode: profileWarningCode,
    } = await loadInitialProfileData();
    const learningStats = await getLearningStats();

    return (
        <ProfilePageClient
            initialProfileData={initialProfileData}
            learningStats={learningStats}
            profileWarningCode={profileWarningCode}
        />
    );
}
