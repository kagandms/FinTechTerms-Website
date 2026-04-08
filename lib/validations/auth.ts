import { getUtcCalendarDate } from '@/lib/time';
import { isAcceptedBirthDateForDate } from '@/lib/profile-birth-date';

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateInputAsLocalDate(value: string): Date | null {
    const normalized = value.trim();
    const match = DATE_INPUT_PATTERN.exec(normalized);

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const parsed = new Date(year, monthIndex, day);

    if (
        Number.isNaN(parsed.getTime())
        || parsed.getFullYear() !== year
        || parsed.getMonth() !== monthIndex
        || parsed.getDate() !== day
    ) {
        return null;
    }

    return parsed;
}

export function isValidRegistrationBirthDate(
    birthDate: string,
    now: Date = new Date()
): boolean {
    return isAcceptedBirthDateForDate(birthDate, getUtcCalendarDate(now));
}
