import ProfilePageClient from './ProfilePageClient';
import { getLearningStats } from '@/app/actions/getLearningStats';
import { createClient } from '@/utils/supabase/server';
import type { ProfileFormInitialData } from '@/components/features/profile/ProfileEditForm';
import type { ProfileWarningCode } from './ProfilePageClient';
import { safeGetSupabaseUser } from '@/lib/auth/session';

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

const loadInitialProfileData = async (): Promise<{
    data: ProfileFormInitialData | null;
    warningCode: ProfileWarningCode | null;
}> => {
    let warningCode: ProfileWarningCode | null = null;
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

    try {
        supabase = await createClient();
    } catch (error) {
        console.error('PROFILE_RSC_CLIENT_ERROR', error);
        return {
            data: null,
            warningCode: 'PROFILE_DATA_LOAD_FAILED',
        };
    }

    if (!supabase) {
        return {
            data: null,
            warningCode: 'PROFILE_DATA_LOAD_FAILED',
        };
    }

    const authState = await safeGetSupabaseUser(supabase);
    if (!authState.user) {
        if (authState.ghostSession && authState.message) {
            console.warn('PROFILE_RSC_GHOST_SESSION_RECOVERED', authState.message);
        }

        return {
            data: null,
            warningCode: null,
        };
    }

    const user = authState.user;

    let fullName = (
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        ''
    ).trim();
    let birthDate = toDateInputValue(user.user_metadata?.birth_date || '');

    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, birth_date')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) {
        console.error('PROFILE_RSC_FETCH_ERROR:', profileError);
        warningCode = 'PROFILE_DATA_PARTIAL';
    } else if (profileData) {
        if (profileData.full_name) {
            fullName = String(profileData.full_name).trim();
        }
        if (profileData.birth_date) {
            birthDate = toDateInputValue(profileData.birth_date);
        }
    }

    const { name, surname } = splitName(fullName);

    return {
        data: {
            userId: user.id,
            email: user.email || '',
            name,
            surname,
            birthDate,
        },
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
