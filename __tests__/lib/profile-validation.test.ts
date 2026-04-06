import { createProfileSchema } from '@/lib/validations/profile';

describe('profile validation', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('accepts provider-backed accounts without an email value', () => {
        const result = createProfileSchema('en').safeParse({
            name: 'Ivan',
            surname: 'Petrov',
            birthDate: '',
            email: null,
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.email).toBeNull();
        }
    });

    it('still rejects malformed email values when one is present', () => {
        const result = createProfileSchema('en').safeParse({
            name: 'Ivan',
            surname: 'Petrov',
            birthDate: '',
            email: 'bad-email',
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        });

        expect(result.success).toBe(false);
    });

    it('uses the same UTC calendar boundary as the server-side birth date guard', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-27T23:30:00-07:00'));

        const schema = createProfileSchema('en');
        const basePayload = {
            name: 'Ivan',
            surname: 'Petrov',
            email: null,
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        };

        const thirteenYearsOld = schema.safeParse({
            ...basePayload,
            birthDate: '2013-03-28',
        });

        const stillTwelve = schema.safeParse({
            ...basePayload,
            birthDate: '2013-03-29',
        });

        expect(thirteenYearsOld.success).toBe(true);
        expect(stillTwelve.success).toBe(false);
    });
});
