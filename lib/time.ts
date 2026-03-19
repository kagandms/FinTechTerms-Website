const UTC_DAY_MS = 24 * 60 * 60 * 1000;

const coerceDate = (value: Date | string): Date => (
    value instanceof Date ? value : new Date(value)
);

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
