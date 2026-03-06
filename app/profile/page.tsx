import ProfilePageClient from './ProfilePageClient';
import { getLearningStats } from '@/app/actions/getLearningStats';
import { createClient } from '@/utils/supabase/server';
import type { ProfileFormInitialData } from '@/components/features/profile/ProfileEditForm';
import type { ProfileWarningCode } from './ProfilePageClient';

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
    const supabase = await createClient();
    let warningCode: ProfileWarningCode | null = null;

    // First safely get session to avoid console AuthSessionMissingError
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
        return { data: null, warningCode: null };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
        if (userError) {
            console.error('PROFILE_RSC_AUTH_ERROR:', userError);
            warningCode = 'PROFILE_DATA_LOAD_FAILED';
        }

        return { data: null, warningCode };
    }

    const user = userData.user;

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
    const [{ data: initialProfileData, warningCode: profileWarningCode }, learningStats] = await Promise.all([
        loadInitialProfileData(),
        getLearningStats(),
    ]);

    return (
        <ProfilePageClient
            initialProfileData={initialProfileData}
            learningStats={learningStats}
            profileWarningCode={profileWarningCode}
        />
    );
}
