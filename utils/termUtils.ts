import { Term } from '@/types';
import { TermSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';

/**
 * Creates a safe, fully-populated Term object from partial or potentially undefined data.
 * Uses Zod for runtime validation to ensure data integrity.
 * 
 * @param data - Partial term data, null, or undefined
 * @returns A validated Term, or null when the payload is malformed
 */
export function createSafeTerm(data: Partial<Term> | null | undefined): Term | null {
    if (!data) {
        return null;
    }

    const result = TermSchema.safeParse(data);

    if (result.success) {
        return result.data as Term;
    }

    logger.warn('TERM_VALIDATION_FAILED', {
        route: 'createSafeTerm',
        issues: result.error.flatten(),
    });
    return null;
}
