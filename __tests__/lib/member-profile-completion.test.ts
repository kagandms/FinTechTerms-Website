import { hasCompleteMemberProfile } from '@/lib/member-profile-completion';

describe('hasCompleteMemberProfile', () => {
    it('accepts a two-part persisted full name with email and accepted birth date', () => {
        expect(hasCompleteMemberProfile({
            fullName: 'Alex Stone',
            birthDate: '2000-01-01',
            email: 'alex@example.com',
        })).toBe(true);
    });

    it('rejects a birth-date-only profile', () => {
        expect(hasCompleteMemberProfile({
            fullName: '',
            birthDate: '2000-01-01',
            email: 'alex@example.com',
        })).toBe(false);
    });

    it('accepts split first and surname fields from profile form state', () => {
        expect(hasCompleteMemberProfile({
            name: 'Alex',
            surname: 'Stone',
            birthDate: '2000-01-01',
            email: 'alex@example.com',
        })).toBe(true);
    });
});
