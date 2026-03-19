/**
 * SRS Data Loading Helpers (M48)
 * Skill: code-refactoring-refactor-clean
 *
 * Extracts the 140+ line loadData function from SRSContext into
 * smaller, testable, single-responsibility functions.
 */

import { Term } from '@/types';
import { createSafeTerm } from '@/utils/termUtils';

/**
 * Deduplicates an array of terms by normalized English title.
 * Keeps the first occurrence of each unique title.
 *
 * Handles edge cases like "51% Attack" vs "51% attack" by normalizing
 * to lowercase alphanumeric characters only.
 */
export function deduplicateTerms(terms: Term[]): Term[] {
    const seen = new Map<string, Term>();

    for (const term of terms) {
        const key = (term.term_en || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        if (!seen.has(key)) {
            seen.set(key, term);
        }
    }

    return Array.from(seen.values());
}

/**
 * Merges DB terms into local terms, preserving local SRS data.
 *
 * Strategy:
 * 1. Existing terms: keep local SRS fields, update content from DB
 * 2. New terms (in DB but not local): add with default SRS values
 * 3. Duplicate titles across different IDs: warn and skip
 */
export function mergeTermsWithDB(localTerms: Term[], dbTerms: Partial<Term>[]): Term[] {
    const dbTermsMap = new Map(dbTerms.map(t => [t.id, t]));
    const localTitleIndex = new Map<string, string>();

    // Build title → id index for duplicate detection
    for (const t of localTerms) {
        const key = normalizeTitle(t.term_en);
        if (key && !localTitleIndex.has(key)) {
            localTitleIndex.set(key, t.id);
        }
    }

    // Step 1: Update existing terms with DB content
    const merged: Term[] = localTerms.map(localTerm => {
        const dbTerm = dbTermsMap.get(localTerm.id);
        if (dbTerm) {
            return createSafeTerm({
                ...localTerm,
                ...dbTerm,
                // Preserve local SRS data
                srs_level: localTerm.srs_level,
                next_review_date: localTerm.next_review_date,
                last_reviewed: localTerm.last_reviewed,
                difficulty_score: localTerm.difficulty_score,
                retention_rate: localTerm.retention_rate,
                times_reviewed: localTerm.times_reviewed,
                times_correct: localTerm.times_correct,
            }) ?? localTerm;
        }
        return localTerm;
    });

    // Step 2: Add new terms from DB
    for (const dbTerm of dbTerms) {
        if (!dbTerm.id) continue;

        const existsById = localTerms.some(t => t.id === dbTerm.id);
        const titleKey = normalizeTitle(dbTerm.term_en || '');
        const existsByTitle = titleKey ? localTitleIndex.has(titleKey) : false;

        if (!existsById && !existsByTitle) {
            const nextTerm = createDefaultSRSTerm(dbTerm);
            if (nextTerm) {
                merged.push(nextTerm);
            }
        }
    }

    return merged;
}

/**
 * Creates a Term with default SRS values from a partial DB record.
 */
export function createDefaultSRSTerm(partial: Partial<Term>): Term | null {
    return createSafeTerm({
        ...partial,
        srs_level: 1,
        next_review_date: new Date().toISOString(),
        last_reviewed: null,
        difficulty_score: 2.5,
        retention_rate: 0,
        times_reviewed: 0,
        times_correct: 0,
    });
}

/**
 * Normalizes a term title for comparison.
 * "51% Attack" → "51attack"
 */
function normalizeTitle(title: string): string {
    return (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
