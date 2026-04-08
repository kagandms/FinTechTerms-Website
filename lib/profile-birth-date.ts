import { calculateAgeFromCalendarDate, getUtcCalendarDate, parseIsoCalendarDate } from '@/lib/time';

const MIN_PROFILE_AGE = 13;
const MAX_PROFILE_AGE = 120;

export const isAcceptedBirthDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return false;
    }

    const birthDate = parseIsoCalendarDate(value);
    if (!birthDate) {
        return false;
    }

    // Entitlement gating intentionally uses UTC calendar math so browser, server,
    // and database checks agree on age-boundary dates.
    const age = calculateAgeFromCalendarDate(birthDate, getUtcCalendarDate());
    return age >= MIN_PROFILE_AGE && age <= MAX_PROFILE_AGE;
};

export const hasPersistedBirthDate = (value: unknown): value is string => (
    isAcceptedBirthDate(value)
);
