/**
 * Supabase Pagination Helper (M25)
 * Skill: database-architect, typescript-pro
 *
 * Provides paginated term fetching for any future database-backed
 * term catalog views that cannot rely on the repo-backed public catalog.
 *
 * Usage:
 *   const { data, hasMore } = await fetchTermsPaginated({ page: 1, pageSize: 50 });
 */

import { filterAcademicTerms, isMissingAcademicColumnError } from '@/lib/academicQuarantine';
import { getSupabaseClient } from '@/lib/supabase';
import { Term } from '@/types';
import { logger } from '@/lib/logger';

export interface PaginationOptions {
    /** 1-indexed page number */
    page: number;
    /** Items per page (default: 50, max: 200) */
    pageSize?: number;
    /** Optional category filter */
    category?: string;
    /** Optional search query */
    search?: string;
}

export interface PaginatedResult<T> {
    data: T[];
    page: number;
    pageSize: number;
    totalCount: number;
    hasMore: boolean;
}

/**
 * Fetch terms with pagination from Supabase.
 *
 * Performance: Reduces bandwidth from loading 1000+ terms to ~50 per page.
 * Uses Supabase range() for efficient offset-based pagination.
 */
export async function fetchTermsPaginated(
    options: PaginationOptions
): Promise<PaginatedResult<Partial<Term>>> {
    const supabase = getSupabaseClient();
    const {
        page,
        pageSize = 50,
        category,
        search,
    } = options;

    // Clamp pageSize to prevent abuse
    const clampedPageSize = Math.min(Math.max(1, pageSize), 200);
    const from = (Math.max(1, page) - 1) * clampedPageSize;
    const to = from + clampedPageSize - 1;

    const buildQuery = (filterAcademicOnly: boolean) => {
        let query = supabase
            .from('terms')
            .select('*', { count: 'exact' });

        if (filterAcademicOnly) {
            query = query.eq('is_academic', true);
        }

        if (category) {
            query = query.eq('category', category);
        }

        if (search) {
            query = query.or(
                `term_en.ilike.%${search}%,term_tr.ilike.%${search}%,term_ru.ilike.%${search}%`
            );
        }

        return query
            .order('term_en', { ascending: true })
            .range(from, to);
    };

    let { data, error, count } = await buildQuery(true);

    if (isMissingAcademicColumnError(error)) {
        logger.warn('PAGINATION_MISSING_ACADEMIC_COLUMN', {
            route: 'fetchTermsPaginated',
        });
        ({ data, error, count } = await buildQuery(false));
    }

    if (error) {
        logger.error('PAGINATION_QUERY_FAILED', {
            route: 'fetchTermsPaginated',
            error: new Error(error.message),
        });
        return {
            data: [],
            page,
            pageSize: clampedPageSize,
            totalCount: 0,
            hasMore: false,
        };
    }

    const totalCount = count ?? 0;

    return {
        data: filterAcademicTerms((data ?? []) as Partial<Term>[]),
        page,
        pageSize: clampedPageSize,
        totalCount,
        hasMore: from + clampedPageSize < totalCount,
    };
}
