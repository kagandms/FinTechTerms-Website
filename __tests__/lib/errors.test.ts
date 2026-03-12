import { toSafeUserError } from '@/lib/errors';

describe('toSafeUserError', () => {
    it('maps known database codes to safe user messages', () => {
        expect(toSafeUserError({ code: '23505' })).toEqual({
            code: '23505',
            message: 'This username is already taken. Please choose another.',
        });

        expect(toSafeUserError({ code: '42501' })).toEqual({
            code: '42501',
            message: 'You do not have permission to perform this action.',
        });
    });

    it('falls back to a generic safe message for unknown inputs', () => {
        expect(toSafeUserError({ code: '99999' })).toEqual({
            code: '99999',
            message: 'Something went wrong. Please try again.',
        });

        expect(toSafeUserError(new Error('raw postgres details'))).toEqual({
            code: 'UNKNOWN',
            message: 'Something went wrong. Please try again.',
        });
    });
});
