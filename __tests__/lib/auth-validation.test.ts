import {
    isValidRegistrationBirthDate,
    parseDateInputAsLocalDate,
} from '@/lib/validations/auth';

describe('auth birth date validation', () => {
    it('parses yyyy-mm-dd without timezone drift', () => {
        const parsed = parseDateInputAsLocalDate('2010-03-06');

        expect(parsed).not.toBeNull();
        expect(parsed?.getFullYear()).toBe(2010);
        expect(parsed?.getMonth()).toBe(2);
        expect(parsed?.getDate()).toBe(6);
    });

    it('accepts a user who is already 13', () => {
        const now = new Date(2026, 2, 6);

        expect(isValidRegistrationBirthDate('2013-03-06', now)).toBe(true);
    });

    it('rejects a user who is still 12', () => {
        const now = new Date(2026, 2, 6);

        expect(isValidRegistrationBirthDate('2013-03-07', now)).toBe(false);
    });

    it('rejects malformed dates', () => {
        expect(isValidRegistrationBirthDate('2026-02-31', new Date(2026, 2, 6))).toBe(false);
        expect(isValidRegistrationBirthDate('not-a-date', new Date(2026, 2, 6))).toBe(false);
    });
});
