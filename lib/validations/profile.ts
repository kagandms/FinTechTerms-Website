import { z } from 'zod';

/**
 * Creates a localized profile validation schema.
 * All error messages are displayed in the user's selected language.
 */
export function createProfileSchema(language: 'tr' | 'en' | 'ru') {
    const msg = {
        nameMin: language === 'tr' ? 'Ad en az 2 karakter olmalıdır' : language === 'ru' ? 'Имя должно содержать минимум 2 символа' : 'Name must be at least 2 characters',
        surnameMin: language === 'tr' ? 'Soyad en az 2 karakter olmalıdır' : language === 'ru' ? 'Фамилия должна содержать минимум 2 символа' : 'Surname must be at least 2 characters',
        birthDateInvalid: language === 'tr' ? 'Geçerli bir tarih girin (13+ yaş)' : language === 'ru' ? 'Введите корректную дату (13+ лет)' : 'Must be a valid date (13+ years old)',
        emailInvalid: language === 'tr' ? 'Geçersiz e-posta adresi' : language === 'ru' ? 'Некорректный e-mail адрес' : 'Invalid email address',
        currentPasswordRequired: language === 'tr' ? 'Yeni şifre belirlemek için mevcut şifre gereklidir' : language === 'ru' ? 'Для установки нового пароля требуется текущий пароль' : 'Current password is required to set a new password',
        newPasswordRequired: language === 'tr' ? 'Yeni şifre gerekli' : language === 'ru' ? 'Новый пароль обязателен' : 'New password is required',
        passwordStrength: language === 'tr' ? 'Şifre en az 8 karakter, 1 büyük harf, 1 küçük harf, 1 rakam, 1 sembol içermelidir' : language === 'ru' ? 'Пароль: мин. 8 символов, 1 заглавная, 1 строчная, 1 цифра, 1 символ' : 'Password must contain at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol',
        passwordsNotMatch: language === 'tr' ? 'Şifreler eşleşmiyor' : language === 'ru' ? 'Пароли не совпадают' : 'Passwords do not match',
    };

    return z.object({
        name: z.string().min(2, msg.nameMin),
        surname: z.string().min(2, msg.surnameMin),
        birthDate: z.string().refine((val) => {
            const dob = new Date(val);
            if (isNaN(dob.getTime())) return false;

            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                age--;
            }
            return age >= 13 && age <= 120;
        }, msg.birthDateInvalid),
        email: z.string().email(msg.emailInvalid),
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
