const UTC_DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

const coerceDate = (value: Date | string): Date => (
    value instanceof Date ? value : new Date(value)
);

export interface CalendarDateParts {
    readonly year: number;
    readonly month: number;
    readonly day: number;
}

export const startOfUtcDay = (value: Date | string): Date => {
    const date = coerceDate(value);
    return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0
    ));
};

export const endOfUtcDay = (value: Date | string): Date => {
    const date = startOfUtcDay(value);
    return new Date(date.getTime() + UTC_DAY_MS - 1);
};

export const addUtcDays = (value: Date | string, days: number): Date => {
    const date = startOfUtcDay(value);
    return new Date(date.getTime() + (days * UTC_DAY_MS));
};

export const toUtcDateKey = (value: Date | string): string => (
    startOfUtcDay(value).toISOString().slice(0, 10)
);

export const parseIsoCalendarDate = (value: string): CalendarDateParts | null => {
    const match = ISO_DATE_PREFIX_PATTERN.exec(value.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() + 1 !== month ||
        parsed.getUTCDate() !== day
    ) {
        return null;
    }

    return { year, month, day };
};

export const getLocalCalendarDate = (value: Date = new Date()): CalendarDateParts => ({
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
});

export const getUtcCalendarDate = (value: Date = new Date()): CalendarDateParts => ({
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
});

export const calculateAgeFromCalendarDate = (
    birthDate: CalendarDateParts,
    currentDate: CalendarDateParts
): number => {
    const hasHadBirthday =
        currentDate.month > birthDate.month ||
        (currentDate.month === birthDate.month && currentDate.day >= birthDate.day);

    if (hasHadBirthday) {
        return currentDate.year - birthDate.year;
    }

    return currentDate.year - birthDate.year - 1;
};

export const formatUtcDateForLocale = (value: Date | string, locale: string): string => {
    const date = coerceDate(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(date);
};
