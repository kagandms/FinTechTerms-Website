import { createProfileSchema } from '@/lib/validations/profile';

describe('profile validation', () => {
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
});
