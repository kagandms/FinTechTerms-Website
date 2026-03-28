import { Term } from '../../types';
import { testCatalogTerms } from './test-catalog';

const assignUniqueSlugs = (catalog: readonly Term[]): Term[] => {
    const slugCounts = new Map<string, number>();

    return catalog.map((term) => {
        const currentCount = slugCounts.get(term.slug) ?? 0;
        slugCounts.set(term.slug, currentCount + 1);

        if (currentCount === 0) {
            return term;
        }

        return {
            ...term,
            slug: `${term.slug}-${currentCount + 1}`,
        };
    });
};

export const terms: Term[] = assignUniqueSlugs([
    ...testCatalogTerms,
]);
