import { Term } from '@/types';
import { TermSchema } from '@/lib/validators';

/**
 * Creates a safe, fully-populated Term object from partial or potentially undefined data.
 * Uses Zod for runtime validation to ensure data integrity.
 * 
 * @param data - Partial term data, null, or undefined
 * @returns A complete Term object with safe defaults
 */
export function createSafeTerm(data: Partial<Term> | null | undefined): Term {
    if (!data) {
        return TermSchema.parse({}); // Returns object with defaults
    }

    const result = TermSchema.safeParse(data);

    if (result.success) {
        return result.data as Term;
    } else {
        console.warn('Term Validation Failed:', result.error);
        // Fallback to safe defaults if validation fails to prevent crash
        return TermSchema.parse({});
    }
}
