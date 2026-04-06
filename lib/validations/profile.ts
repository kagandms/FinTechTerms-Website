import { z } from 'zod';
import { getTranslationString } from '@/lib/i18n';
import { isAcceptedBirthDate } from '@/lib/profile-birth-date';
import type { Language } from '@/types';

/**
 * Creates a localized profile validation schema.
 * All error messages are displayed in the user's selected language.
 */
export function createProfileSchema(language: Language) {
    const msg = {
        nameMin: getTranslationString(language, 'profileValidation.nameMin') ?? 'Name must be at least 2 characters',
        surnameMin: getTranslationString(language, 'profileValidation.surnameMin') ?? 'Surname must be at least 2 characters',
        birthDateInvalid: getTranslationString(language, 'profileValidation.birthDateInvalid') ?? 'Must be a valid date (13+ years old)',
        emailInvalid: getTranslationString(language, 'profileValidation.emailInvalid') ?? 'Invalid email address',
        currentPasswordRequired: getTranslationString(language, 'profileValidation.currentPasswordRequired') ?? 'Current password is required to set a new password',
        newPasswordRequired: getTranslationString(language, 'profileValidation.newPasswordRequired') ?? 'New password is required',
        passwordStrength: getTranslationString(language, 'profileValidation.passwordStrength') ?? 'Password must contain at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol',
        passwordsNotMatch: getTranslationString(language, 'profileValidation.passwordsNotMatch') ?? 'Passwords do not match',
    };

    const nullableEmailSchema = z.union([
        z.string().trim().email(msg.emailInvalid),
        z.literal('').transform(() => null),
        z.null(),
    ]);

    return z.object({
        name: z.string().min(2, msg.nameMin),
        surname: z.string().min(2, msg.surnameMin),
        birthDate: z.string().optional().refine((val) => {
            if (!val || val.trim() === '') return true; // Boş/geçersiz gönderimlerde DB'ye boş gitmesine izin ver ya da bloklanmasını iptal et
            return isAcceptedBirthDate(val);
        }, msg.birthDateInvalid),
        email: nullableEmailSchema,
        // Password fields are optional unless the user wants to change them
        currentPassword: z.string().optional(),
        newPassword: z.string().optional(),
        confirmPassword: z.string().optional()
    }).superRefine((data, ctx) => {
        // If user filled any password field, apply strict validation
        if (data.currentPassword || data.newPassword || data.confirmPassword) {
            if (!data.currentPassword) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: msg.currentPasswordRequired,
                    path: ["currentPassword"]
                });
            }

            if (!data.newPassword) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: msg.newPasswordRequired,
                    path: ["newPassword"]
                });
                return;
            }

            const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            if (!strongPasswordRegex.test(data.newPassword)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: msg.passwordStrength,
                    path: ["newPassword"]
                });
            }

            if (data.newPassword !== data.confirmPassword) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: msg.passwordsNotMatch,
                    path: ["confirmPassword"]
                });
            }
        }
    });
}

// Keep backward-compatible export for static usage
export const profileSchema = createProfileSchema('en');

export type ProfileFormValues = z.infer<typeof profileSchema>;
