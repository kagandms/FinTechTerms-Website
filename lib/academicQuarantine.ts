import type { Term } from '@/types';

type AcademicTermLike = Pick<Partial<Term>, 'is_academic'>;
type AcademicColumnErrorLike = {
    code?: string | null;
    message?: string | null;
};

export function isAcademicTerm(term: AcademicTermLike | null | undefined): boolean {
    return term?.is_academic !== false;
}

export function filterAcademicTerms<T extends AcademicTermLike>(terms: T[]): T[] {
    return terms.filter((term) => isAcademicTerm(term));
}

export function isMissingAcademicColumnError(
    error: AcademicColumnErrorLike | null | undefined
): boolean {
    return error?.code === '42703'
        && typeof error.message === 'string'
        && error.message.includes('is_academic');
}
