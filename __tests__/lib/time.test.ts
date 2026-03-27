import {
    calculateAgeFromCalendarDate,
    formatUtcDateForLocale,
    parseIsoCalendarDate,
} from '@/lib/time';

describe('time helpers', () => {
    it('parses ISO calendar dates without timezone shifts', () => {
        expect(parseIsoCalendarDate('2026-03-11')).toEqual({
            year: 2026,
            month: 3,
            day: 11,
        });

        expect(parseIsoCalendarDate('2026-03-11T00:30:00.000Z')).toEqual({
            year: 2026,
            month: 3,
            day: 11,
        });
    });

    it('rejects impossible calendar dates', () => {
        expect(parseIsoCalendarDate('2026-02-30')).toBeNull();
    });

    it('calculates age from calendar dates without time-of-day drift', () => {
        expect(calculateAgeFromCalendarDate(
            { year: 2013, month: 3, day: 28 },
            { year: 2026, month: 3, day: 27 }
        )).toBe(12);

        expect(calculateAgeFromCalendarDate(
            { year: 2013, month: 3, day: 28 },
            { year: 2026, month: 3, day: 28 }
        )).toBe(13);
    });

    it('formats reviewed dates using the UTC calendar day', () => {
        const reviewedAt = '2026-03-11T00:30:00.000Z';
        const utcFormat = new Intl.DateTimeFormat('en', { timeZone: 'UTC' }).format(new Date(reviewedAt));
        const losAngelesFormat = new Intl.DateTimeFormat('en', { timeZone: 'America/Los_Angeles' }).format(new Date(reviewedAt));

        expect(formatUtcDateForLocale(reviewedAt, 'en')).toBe(utcFormat);
        expect(utcFormat).not.toBe(losAngelesFormat);
    });
});
