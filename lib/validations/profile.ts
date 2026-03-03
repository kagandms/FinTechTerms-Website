import { z } from 'zod';

export const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    surname: z.string().min(2, "Surname must be at least 2 characters"),
    birthYear: z.string().refine((val) => {
        const year = parseInt(val);
        const currentYear = new Date().getFullYear();
        return year >= 1900 && year <= currentYear - 13;
    }, "Must be a valid year (13+ years old)"),
    email: z.string().email("Invalid email address"),
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
                message: "Current password is required to set a new password",
                path: ["currentPassword"]
            });
        }

        if (!data.newPassword) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "New password is required",
                path: ["newPassword"]
            });
            return;
        }

        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!strongPasswordRegex.test(data.newPassword)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Password must contain at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol",
                path: ["newPassword"]
            });
        }

        if (data.newPassword !== data.confirmPassword) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Passwords do not match",
                path: ["confirmPassword"]
            });
        }
    }
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
