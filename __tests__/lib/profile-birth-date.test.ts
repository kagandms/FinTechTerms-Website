import { hasPersistedBirthDate, isAcceptedBirthDate } from '@/lib/profile-birth-date';

describe('profile birth date guard', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-04-05T12:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('accepts a persisted birth date for an allowed age range', () => {
        expect(isAcceptedBirthDate('2000-01-01')).toBe(true);
        expect(hasPersistedBirthDate('2000-01-01')).toBe(true);
    });

    it('rejects malformed or out-of-policy persisted birth dates', () => {
        expect(isAcceptedBirthDate('2026-02-31')).toBe(false);
        expect(isAcceptedBirthDate('2026-04-06')).toBe(false);
        expect(isAcceptedBirthDate('2014-04-06')).toBe(false);
        expect(isAcceptedBirthDate('1905-04-04')).toBe(false);
        expect(hasPersistedBirthDate('')).toBe(false);
    });

    it('uses UTC calendar boundaries for age validation', () => {
        jest.setSystemTime(new Date('2026-04-05T23:30:00-07:00'));

        expect(isAcceptedBirthDate('2013-04-06')).toBe(true);
        expect(isAcceptedBirthDate('2013-04-07')).toBe(false);
    });
});
