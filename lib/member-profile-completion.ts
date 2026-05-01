import { hasPersistedBirthDate } from '@/lib/profile-birth-date';

interface MemberProfileCompletionInput {
    readonly fullName?: unknown;
    readonly name?: unknown;
    readonly surname?: unknown;
    readonly birthDate?: unknown;
    readonly email?: unknown;
}

const normalizeRequiredProfileField = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim();
    return normalizedValue || null;
};

const hasCompleteFullName = (fullName: unknown): boolean => {
    const normalizedFullName = normalizeRequiredProfileField(fullName);
    if (!normalizedFullName) {
        return false;
    }

    return normalizedFullName.split(/\s+/u).filter(Boolean).length >= 2;
};

const hasCompleteSplitName = (name: unknown, surname: unknown): boolean => (
    Boolean(normalizeRequiredProfileField(name))
    && Boolean(normalizeRequiredProfileField(surname))
);

const hasCompleteProfileName = ({
    fullName,
    name,
    surname,
}: MemberProfileCompletionInput): boolean => (
    hasCompleteFullName(fullName) || hasCompleteSplitName(name, surname)
);

/**
 * Checks whether a member profile has the identity fields required to unlock member-only features.
 *
 * @param profile - Candidate profile fields from either persisted profile data or form initial state.
 * @returns True only when name, email, and accepted birth date are all present.
 */
export const hasCompleteMemberProfile = (profile: MemberProfileCompletionInput): boolean => (
    hasCompleteProfileName(profile)
    && hasPersistedBirthDate(profile.birthDate)
    && Boolean(normalizeRequiredProfileField(profile.email))
);
